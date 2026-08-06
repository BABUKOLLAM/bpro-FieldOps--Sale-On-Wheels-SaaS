from datetime import date
from decimal import Decimal

import pytest
from django.core.management import call_command

from apps.fleet.models import Trip, TripCheckpoint
from apps.integrations.models import ERPConnection, SyncLogEntry
from apps.integrations.tasks import enqueue_tally_job
from apps.inventory.models import VanStock
from apps.sales.models import Invoice, InvoiceLine
from apps.sales.services import finalize_invoice


@pytest.mark.django_db
def test_seed_demo_data_runs_end_to_end():
    """The seed command touches nearly every app's models — if this
    passes, the whole model layer + migrations are internally consistent."""
    call_command("seed_demo_data")

    from apps.accounts.models import User

    assert User.objects.filter(username="admin@demo.local").exists()
    assert User.objects.filter(username="agent@demo.local").exists()


@pytest.mark.django_db
def test_invoice_finalize_computes_gst_and_deducts_stock(company, agent, van_godown, item, customer):
    _, gst_registration = company
    invoice = Invoice.objects.create(
        customer=customer, agent=agent, godown=van_godown, gst_registration=gst_registration,
        place_of_supply_state=gst_registration.state, invoice_date=date.today(),
    )
    InvoiceLine.objects.create(invoice=invoice, item=item, qty=Decimal("5"), rate=Decimal("20.00"))

    finalize_invoice(invoice)
    invoice.refresh_from_db()
    line = invoice.lines.get()

    # 5 * 20 = 100 taxable; 18% GST, same-state -> split CGST/SGST 9%/9%.
    assert line.taxable_amount == Decimal("100.00")
    assert line.cgst_amount == Decimal("9.00")
    assert line.sgst_amount == Decimal("9.00")
    assert line.igst_amount == Decimal("0.00")
    assert invoice.grand_total == Decimal("118.00")
    assert invoice.invoice_no  # document number assigned
    assert invoice.credit_check_status == Invoice.CREDIT_OK

    van_stock = VanStock.objects.get(godown=van_godown, item=item)
    assert van_stock.qty_on_hand == Decimal("45")  # 50 loaded - 5 sold

    customer.refresh_from_db()
    assert customer.outstanding_balance == Decimal("118.00")


@pytest.mark.django_db
def test_credit_limit_breach_flags_pending_review(company, agent, van_godown, item, customer):
    _, gst_registration = company
    customer.credit_limit = Decimal("50.00")  # invoice will exceed this
    customer.save()

    invoice = Invoice.objects.create(
        customer=customer, agent=agent, godown=van_godown, gst_registration=gst_registration,
        place_of_supply_state=gst_registration.state, invoice_date=date.today(),
    )
    InvoiceLine.objects.create(invoice=invoice, item=item, qty=Decimal("5"), rate=Decimal("20.00"))

    finalize_invoice(invoice)
    invoice.refresh_from_db()

    # BRD FR-11: billing is never blocked outright — it's flagged for
    # supervisor review (AR-04), and stock is still deducted.
    assert invoice.credit_check_status == Invoice.CREDIT_PENDING_REVIEW
    assert VanStock.objects.get(godown=van_godown, item=item).qty_on_hand == Decimal("45")


@pytest.mark.django_db
def test_sync_log_entry_dedup_on_repeat_enqueue(company, agent, van_godown, item, customer):
    _, gst_registration = company
    ERPConnection.objects.create(erp_type=ERPConnection.ERP_MOCK, sync_mode=ERPConnection.SYNC_BATCH)

    invoice = Invoice.objects.create(
        customer=customer, agent=agent, godown=van_godown, gst_registration=gst_registration,
        place_of_supply_state=gst_registration.state, invoice_date=date.today(),
    )
    InvoiceLine.objects.create(invoice=invoice, item=item, qty=Decimal("1"), rate=Decimal("10.00"))
    finalize_invoice(invoice)  # already enqueues one sync job via transaction.on_commit — but
    # on_commit callbacks don't fire outside a real commit in TestCase; call explicitly below too.

    enqueue_tally_job("invoice", invoice.id)
    enqueue_tally_job("invoice", invoice.id)
    enqueue_tally_job("invoice", invoice.id)

    assert SyncLogEntry.objects.filter(entity_type="invoice", local_object_id=invoice.id).count() == 1


@pytest.mark.django_db
def test_mobile_push_is_idempotent(company, agent, van_godown, item, customer):
    import uuid

    from rest_framework.test import APIClient

    _, gst_registration = company
    client = APIClient()
    client.force_authenticate(user=agent)

    from apps.accounts.models import Device

    Device.objects.create(user=agent, device_id="test-device-1", platform="android")

    invoice_id = str(uuid.uuid4())
    payload = {
        "items": [
            {
                "entity_type": "invoice",
                "payload": {
                    "id": invoice_id,
                    "customer": str(customer.id),
                    "agent": str(agent.id),
                    "godown": str(van_godown.id),
                    "gst_registration": str(gst_registration.id),
                    "place_of_supply_state": gst_registration.state,
                    "invoice_date": str(date.today()),
                    "lines": [{"item": str(item.id), "qty": "2", "rate": "20.00"}],
                },
            }
        ]
    }

    response1 = client.post("/api/sync/push/", payload, format="json")
    assert response1.status_code == 200
    assert response1.data["results"][0]["status"] == "applied"
    assert Invoice.objects.filter(id=invoice_id).count() == 1

    response2 = client.post("/api/sync/push/", payload, format="json")
    assert response2.status_code == 200
    assert response2.data["results"][0]["status"] == "applied"
    # No duplicate invoice, and stock was only deducted once.
    assert Invoice.objects.filter(id=invoice_id).count() == 1
    assert VanStock.objects.get(godown=van_godown, item=item).qty_on_hand == Decimal("48")


@pytest.mark.django_db
def test_mobile_push_trip_and_checkpoint(agent, customer):
    """Regression test for the offline Trip Start/End push flow (FR-08 /
    FM-01): the mobile app records status/start_time/end_time locally and
    pushes the *already-complete* trip via the generic sync endpoint,
    rather than calling the online start/end actions — so those fields
    must be writable via a plain push, and a checkpoint must be pushable
    once its parent trip exists server-side, even in a later sync cycle."""
    import uuid

    from rest_framework.test import APIClient

    from apps.accounts.models import Device

    client = APIClient()
    client.force_authenticate(user=agent)
    Device.objects.create(user=agent, device_id="test-device-trip", platform="android")

    trip_id = str(uuid.uuid4())
    trip_payload = {
        "items": [
            {
                "entity_type": "trip",
                "payload": {
                    "id": trip_id,
                    "status": "completed",
                    "start_time": "2026-08-06T09:00:00Z",
                    "end_time": "2026-08-06T17:00:00Z",
                    "start_odometer": "100.0",
                    "end_odometer": "150.0",
                },
            }
        ]
    }
    response = client.post("/api/sync/push/", trip_payload, format="json")
    assert response.status_code == 200
    assert response.data["results"][0]["status"] == "applied"

    trip = Trip.objects.get(id=trip_id)
    # The fields the offline app actually recorded must have been saved,
    # not silently dropped by a read-only serializer field.
    assert trip.status == "completed"
    assert trip.start_odometer == Decimal("100.0")
    assert trip.end_odometer == Decimal("150.0")
    assert trip.agent_id == agent.id  # forced server-side, never trusted from the client

    checkpoint_id = str(uuid.uuid4())
    checkpoint_payload = {
        "items": [
            {
                "entity_type": "trip_checkpoint",
                "payload": {
                    "id": checkpoint_id,
                    "trip": trip_id,
                    "customer": str(customer.id),
                    "check_in_time": "2026-08-06T10:00:00Z",
                    "check_out_time": "2026-08-06T10:15:00Z",
                },
            }
        ]
    }
    response = client.post("/api/sync/push/", checkpoint_payload, format="json")
    assert response.status_code == 200
    assert response.data["results"][0]["status"] == "applied"
    assert TripCheckpoint.objects.filter(id=checkpoint_id, trip=trip).exists()
