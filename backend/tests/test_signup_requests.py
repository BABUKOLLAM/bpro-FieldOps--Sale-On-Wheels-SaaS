from django.core import mail
from rest_framework.test import APIClient

import pytest

from apps.accounts.constants import ROLE_VAN_SALESMAN
from apps.accounts.models import Role, SignupRequest, User

pytestmark = pytest.mark.django_db


def test_public_create_needs_no_auth_and_notifies(admin):
    """admin fixture (IT Head role) holds PERM_USERS_MANAGE — the
    "stakeholder" who should get notified. The fixture itself leaves
    email blank, so set one — a blank email is deliberately excluded
    from notification recipients (see notifications._stakeholder_emails)."""
    admin.email = "admin@test.local"
    admin.save(update_fields=["email"])

    client = APIClient()
    resp = client.post(
        "/api/signup-requests/",
        {
            "name": "New Agent",
            "email": "new.agent@example.com",
            "phone": "9876543210",
            "requested_role_name": ROLE_VAN_SALESMAN,
            "department": "Sales",
            "message": "Joining next Monday.",
        },
        format="json",
    )
    assert resp.status_code == 201
    assert SignupRequest.objects.filter(email="new.agent@example.com", status="pending").exists()

    # One email to the stakeholder (admin), one receipt to the requester.
    assert len(mail.outbox) == 2
    recipients = {m.to[0] for m in mail.outbox}
    assert recipients == {"admin@test.local", "new.agent@example.com"}


def test_non_approver_cannot_list_or_approve(agent, back_office_admin):
    signup = SignupRequest.objects.create(name="X", email="x@example.com")

    client = APIClient()
    client.force_authenticate(user=agent)  # van salesman — no PERM_USERS_MANAGE
    assert client.get("/api/signup-requests/").status_code == 403
    assert client.post(f"/api/signup-requests/{signup.id}/approve/", {"password": "whatever123"}).status_code == 403


def test_approve_creates_real_user_with_role(back_office_admin):
    Role.seed_defaults()
    role = Role.objects.get(name=ROLE_VAN_SALESMAN)
    signup = SignupRequest.objects.create(
        name="Priya Sharma", email="priya@example.com", phone="9000000000",
        requested_role_name=ROLE_VAN_SALESMAN,
    )

    client = APIClient()
    client.force_authenticate(user=back_office_admin)
    resp = client.post(
        f"/api/signup-requests/{signup.id}/approve/",
        {"password": "TempPass#123", "role": str(role.id)},
        format="json",
    )
    assert resp.status_code == 200

    signup.refresh_from_db()
    assert signup.status == "approved"
    assert signup.decided_by == back_office_admin
    assert signup.created_user is not None

    new_user = User.objects.get(email="priya@example.com")
    assert new_user.first_name == "Priya"
    assert new_user.last_name == "Sharma"
    assert new_user.check_password("TempPass#123")
    assert new_user.employee_code is None  # never "" — see the unique-constraint comment in views.py
    assert role.name in [r.name for r in Role.objects.filter(user_roles__user=new_user)]


def test_reject_sends_notice_and_blocks_further_action(back_office_admin):
    signup = SignupRequest.objects.create(name="Rejected Guy", email="reject.me@example.com")

    client = APIClient()
    client.force_authenticate(user=back_office_admin)
    resp = client.post(
        f"/api/signup-requests/{signup.id}/reject/", {"reason": "Role not currently open."}, format="json"
    )
    assert resp.status_code == 200
    signup.refresh_from_db()
    assert signup.status == "rejected"
    assert any(m.to == ["reject.me@example.com"] for m in mail.outbox)

    # Already decided — can't approve or reject again.
    resp = client.post(f"/api/signup-requests/{signup.id}/approve/", {"password": "x"}, format="json")
    assert resp.status_code == 400


def test_approving_with_duplicate_email_returns_clean_400(back_office_admin):
    User.objects.create_user(username="dup@example.com", email="dup@example.com", password="x")
    signup = SignupRequest.objects.create(name="Dup User", email="dup@example.com")

    client = APIClient()
    client.force_authenticate(user=back_office_admin)
    resp = client.post(f"/api/signup-requests/{signup.id}/approve/", {"password": "x"}, format="json")
    assert resp.status_code == 400
