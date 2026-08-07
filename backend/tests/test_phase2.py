import io
import uuid
from datetime import date, datetime, timezone as dt_timezone
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.catalog.models import Scheme, SchemeSlab
from apps.customers.models import Beat, BeatCustomer
from apps.expenses.models import Expense
from apps.fleet.models import LocationPing, Trip
from apps.sales.models import Invoice, InvoiceLine
from apps.sales.services import best_scheme_discount, finalize_invoice


@pytest.mark.django_db
def test_slab_discount_picks_correct_tier(item):
    scheme = Scheme.objects.create(
        name="Volume discount", item=item, discount_type=Scheme.DISCOUNT_SLAB,
        valid_from=date(2020, 1, 1), valid_to=date(2030, 1, 1),
    )
    SchemeSlab.objects.create(
        scheme=scheme, min_qty=Decimal("1"), max_qty=Decimal("9"),
        discount_type=Scheme.DISCOUNT_PERCENT, value=Decimal("0"),
    )
    SchemeSlab.objects.create(
        scheme=scheme, min_qty=Decimal("10"), max_qty=Decimal("49"),
        discount_type=Scheme.DISCOUNT_PERCENT, value=Decimal("5"),
    )
    SchemeSlab.objects.create(
        scheme=scheme, min_qty=Decimal("50"), max_qty=None,
        discount_type=Scheme.DISCOUNT_PERCENT, value=Decimal("10"),
    )

    # Below the first real discount tier: 0% off.
    assert best_scheme_discount(item, Decimal("5"), Decimal("20.00"), date(2026, 1, 1)) == Decimal("0")
    # Middle tier: 10 * 20 = 200 gross, 5% off = 10.00.
    assert best_scheme_discount(item, Decimal("10"), Decimal("20.00"), date(2026, 1, 1)) == Decimal("10.00")
    # Boundary of the middle tier (49, not 50) still gets 5%, not 10%.
    assert best_scheme_discount(item, Decimal("49"), Decimal("20.00"), date(2026, 1, 1)) == Decimal("49.00")
    # Open-ended top tier: 60 * 20 = 1200 gross, 10% off = 120.00.
    assert best_scheme_discount(item, Decimal("60"), Decimal("20.00"), date(2026, 1, 1)) == Decimal("120.00")


@pytest.mark.django_db
def test_expense_create_via_api_defaults_to_submitted(agent):
    client = APIClient()
    client.force_authenticate(user=agent)

    response = client.post(
        "/api/expenses/",
        {"category": Expense.CATEGORY_FUEL, "amount": "450.00", "expense_date": str(date.today())},
        format="json",
    )
    assert response.status_code == 201, response.data
    assert response.data["status"] == Expense.STATUS_SUBMITTED
    assert response.data["agent"] == agent.id  # forced server-side, not client-trusted


@pytest.mark.django_db
def test_expense_agent_cannot_see_others_but_supervisor_can(agent, supervisor):
    other_client = APIClient()
    from apps.accounts.models import Role, User, UserRole
    from apps.accounts.constants import ROLE_VAN_SALESMAN

    other_agent = User.objects.create_user(username="other-agent@test.local", password="testpass123", is_field_agent=True)
    UserRole.objects.create(user=other_agent, role=Role.objects.get(name=ROLE_VAN_SALESMAN))

    Expense.objects.create(agent=agent, category=Expense.CATEGORY_TOLL, amount=Decimal("50"), expense_date=date.today())
    Expense.objects.create(agent=other_agent, category=Expense.CATEGORY_FOOD, amount=Decimal("120"), expense_date=date.today())

    agent_client = APIClient()
    agent_client.force_authenticate(user=agent)
    response = agent_client.get("/api/expenses/")
    assert response.data["count"] == 1  # only their own

    supervisor_client = APIClient()
    supervisor_client.force_authenticate(user=supervisor)
    response = supervisor_client.get("/api/expenses/")
    assert response.data["count"] == 2  # sees everyone's


@pytest.mark.django_db
def test_expense_approve_and_reject_workflow(agent, supervisor):
    expense = Expense.objects.create(
        agent=agent, category=Expense.CATEGORY_MISC, amount=Decimal("200"), expense_date=date.today(),
    )

    # A plain agent (no expenses.approve permission) cannot approve.
    agent_client = APIClient()
    agent_client.force_authenticate(user=agent)
    response = agent_client.post(f"/api/expenses/{expense.id}/approve/")
    assert response.status_code == 403

    supervisor_client = APIClient()
    supervisor_client.force_authenticate(user=supervisor)
    response = supervisor_client.post(f"/api/expenses/{expense.id}/approve/")
    assert response.status_code == 200
    expense.refresh_from_db()
    assert expense.status == Expense.STATUS_APPROVED
    assert expense.approved_by_id == supervisor.id
    assert expense.approved_at is not None

    expense2 = Expense.objects.create(
        agent=agent, category=Expense.CATEGORY_FUEL, amount=Decimal("75"), expense_date=date.today(),
    )
    response = supervisor_client.post(f"/api/expenses/{expense2.id}/reject/", {"reason": "Missing receipt"}, format="json")
    assert response.status_code == 200
    expense2.refresh_from_db()
    assert expense2.status == Expense.STATUS_REJECTED
    assert expense2.rejection_reason == "Missing receipt"


@pytest.mark.django_db
def test_expense_push_is_idempotent(agent):
    from apps.accounts.models import Device

    client = APIClient()
    client.force_authenticate(user=agent)
    Device.objects.create(user=agent, device_id="test-device-expense", platform="android")

    expense_id = str(uuid.uuid4())
    payload = {
        "items": [
            {
                "entity_type": "expense",
                "payload": {
                    "id": expense_id, "category": "fuel", "amount": "300.00",
                    "expense_date": str(date.today()), "description": "Fuel top-up",
                },
            }
        ]
    }

    response1 = client.post("/api/sync/push/", payload, format="json")
    assert response1.status_code == 200
    assert response1.data["results"][0]["status"] == "applied"
    assert Expense.objects.filter(id=expense_id).count() == 1

    response2 = client.post("/api/sync/push/", payload, format="json")
    assert response2.status_code == 200
    assert response2.data["results"][0]["status"] == "applied"
    assert Expense.objects.filter(id=expense_id).count() == 1  # no duplicate

    expense = Expense.objects.get(id=expense_id)
    assert expense.agent_id == agent.id  # forced server-side


@pytest.mark.django_db
def test_invoice_signature_upload_via_multipart_patch(company, agent, van_godown, item, customer):
    """Confirms the plan's assumption: PATCH with just signature_image
    works with zero custom upload endpoint, because InvoiceSerializer has
    no update() override and DRF's default ModelSerializer.update() only
    touches keys present in validated_data (partial=True on PATCH)."""
    _, gst_registration = company
    invoice = Invoice.objects.create(
        customer=customer, agent=agent, godown=van_godown, gst_registration=gst_registration,
        place_of_supply_state=gst_registration.state, invoice_date=date.today(),
    )
    InvoiceLine.objects.create(invoice=invoice, item=item, qty=Decimal("1"), rate=Decimal("10.00"))
    finalize_invoice(invoice)

    client = APIClient()
    client.force_authenticate(user=agent)

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (2, 2), color="white").save(buf, format="PNG")
    buf.seek(0)
    buf.name = "signature.png"

    response = client.patch(
        f"/api/sales/invoices/{invoice.id}/", {"signature_image": buf}, format="multipart",
    )
    assert response.status_code == 200, response.data

    invoice.refresh_from_db()
    assert invoice.signature_image.name.startswith("signatures/")
    # The rest of the invoice must be untouched by a signature-only PATCH.
    assert invoice.lines.count() == 1
    assert invoice.grand_total == Decimal("11.80")


@pytest.mark.django_db
def test_location_ping_push_is_idempotent(agent):
    from apps.accounts.models import Device

    client = APIClient()
    client.force_authenticate(user=agent)
    Device.objects.create(user=agent, device_id="test-device-gps", platform="android")

    ping_id = str(uuid.uuid4())
    payload = {
        "items": [
            {
                "entity_type": "location_ping",
                "payload": {
                    "id": ping_id, "latitude": "19.123456", "longitude": "72.654321",
                    "recorded_at": "2026-08-07T10:30:00Z",
                },
            }
        ]
    }

    response1 = client.post("/api/sync/push/", payload, format="json")
    assert response1.status_code == 200
    assert response1.data["results"][0]["status"] == "applied"
    assert LocationPing.objects.filter(id=ping_id).count() == 1

    response2 = client.post("/api/sync/push/", payload, format="json")
    assert response2.status_code == 200
    assert LocationPing.objects.filter(id=ping_id).count() == 1  # no duplicate

    ping = LocationPing.objects.get(id=ping_id)
    assert ping.agent_id == agent.id  # forced server-side


@pytest.mark.django_db
def test_live_map_returns_active_agent_with_location_and_beat_progress(agent, supervisor, customer):
    beat = Beat.objects.create(name="Route 1", assigned_agent=agent)
    BeatCustomer.objects.create(beat=beat, customer=customer, visit_sequence=1)

    trip = Trip.objects.create(
        agent=agent, beat=beat, status=Trip.STATUS_IN_PROGRESS,
        start_time=datetime(2026, 8, 7, 9, 0, tzinfo=dt_timezone.utc),
        start_latitude=Decimal("19.100000"), start_longitude=Decimal("72.900000"),
    )
    LocationPing.objects.create(
        agent=agent, trip=trip, latitude=Decimal("19.200000"), longitude=Decimal("72.800000"),
        recorded_at=datetime(2026, 8, 7, 10, 0, tzinfo=dt_timezone.utc),
    )

    client = APIClient()
    client.force_authenticate(user=supervisor)
    response = client.get("/api/reporting/live-map/")
    assert response.status_code == 200, response.data

    agents = response.data["agents"]
    assert len(agents) == 1
    entry = agents[0]
    assert entry["agent_id"] == agent.id
    assert entry["trip_id"] == trip.id
    # The most recent LocationPing wins over the trip's own start location.
    assert Decimal(str(entry["last_location"]["latitude"])) == Decimal("19.200000")
    assert entry["beat_name"] == "Route 1"
    assert len(entry["stops"]) == 1
    assert entry["stops"][0]["customer_id"] == customer.id
    assert entry["stops"][0]["status"] == "pending"  # no checkpoint recorded yet
