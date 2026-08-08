import pytest
from rest_framework.test import APIClient

from apps.accounts.constants import ROLE_SUPER_ADMIN, ROLE_VAN_SALESMAN
from apps.accounts.models import Role, User, UserRole
from apps.governance.models import ChangeRequest


@pytest.fixture
def super_admin(db):
    Role.seed_defaults()
    role = Role.objects.get(name=ROLE_SUPER_ADMIN)
    user = User.objects.create_user(username="superadmin@test.local", password="testpass123")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def target_role(db):
    Role.seed_defaults()
    return Role.objects.get(name=ROLE_VAN_SALESMAN)


def _propose(client, role, changes, reason=""):
    return client.post(
        "/api/governance/change-requests/",
        {"target_type": "role", "target_id": str(role.id), "proposed_changes": changes, "reason": reason},
        format="json",
    )


@pytest.mark.django_db
def test_field_agent_cannot_propose_a_change(agent, target_role):
    client = APIClient()
    client.force_authenticate(user=agent)
    response = _propose(client, target_role, {"permissions": ["sales.invoice.create"]})
    assert response.status_code == 403


@pytest.mark.django_db
def test_unknown_target_type_is_rejected(admin):
    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.post(
        "/api/governance/change-requests/",
        {"target_type": "user", "target_id": str(admin.id), "proposed_changes": {"is_active": False}},
        format="json",
    )
    assert response.status_code == 400
    assert "target_type" in response.data


@pytest.mark.django_db
def test_ungoverned_field_is_rejected(admin, target_role):
    client = APIClient()
    client.force_authenticate(user=admin)
    # "name" is Role's identity field — deliberately not in the governed
    # field allowlist (see apps.accounts.governance.ROLE_GOVERNED_FIELDS).
    response = _propose(client, target_role, {"name": "not_a_real_role"})
    assert response.status_code == 400
    assert "proposed_changes" in response.data


@pytest.mark.django_db
def test_empty_changes_are_rejected(admin, target_role):
    client = APIClient()
    client.force_authenticate(user=admin)
    response = _propose(client, target_role, {})
    assert response.status_code == 400


@pytest.mark.django_db
def test_proposing_captures_previous_snapshot(admin, target_role):
    original_permissions = list(target_role.permissions)
    client = APIClient()
    client.force_authenticate(user=admin)
    response = _propose(client, target_role, {"permissions": ["sales.invoice.create"]}, reason="tighten access")
    assert response.status_code == 201, response.data
    assert response.data["previous_snapshot"] == {"permissions": original_permissions}
    assert response.data["reason"] == "tighten access"
    assert response.data["target_type"] == "role"
    assert response.data["status"] == "pending"

    change_request = ChangeRequest.objects.get(pk=response.data["id"])
    assert change_request.requested_by_id == admin.id
    assert change_request.target.pk == target_role.pk


@pytest.mark.django_db
def test_it_head_can_propose_but_not_approve(admin, target_role):
    """`admin` fixture holds ROLE_SYSTEM_IT_ADMIN ("IT Head") — per the
    client's own instruction, IT Head may propose master-settings/role
    changes but only Super Admin/Admin may approve them."""
    client = APIClient()
    client.force_authenticate(user=admin)
    propose_response = _propose(client, target_role, {"permissions": ["sales.invoice.create"]})
    assert propose_response.status_code == 201

    approve_response = client.post(
        f"/api/governance/change-requests/{propose_response.data['id']}/approve/", format="json"
    )
    assert approve_response.status_code == 403

    target_role.refresh_from_db()
    assert target_role.permissions != ["sales.invoice.create"]


@pytest.mark.django_db
def test_admin_approve_applies_the_change(back_office_admin, target_role):
    client = APIClient()
    client.force_authenticate(user=back_office_admin)
    propose_response = _propose(client, target_role, {"permissions": ["sales.invoice.create"], "is_active": False})
    change_request_id = propose_response.data["id"]

    approve_response = client.post(
        f"/api/governance/change-requests/{change_request_id}/approve/", {"note": "looks right"}, format="json"
    )
    assert approve_response.status_code == 200, approve_response.data
    assert approve_response.data["status"] == "approved"
    assert approve_response.data["review_note"] == "looks right"
    assert approve_response.data["reviewed_by_username"] == back_office_admin.username

    target_role.refresh_from_db()
    assert target_role.permissions == ["sales.invoice.create"]
    assert target_role.is_active is False


@pytest.mark.django_db
def test_super_admin_can_approve(super_admin, target_role):
    client = APIClient()
    client.force_authenticate(user=super_admin)
    propose_response = _propose(client, target_role, {"permissions": ["sales.invoice.create"]})
    approve_response = client.post(
        f"/api/governance/change-requests/{propose_response.data['id']}/approve/", format="json"
    )
    assert approve_response.status_code == 200
    target_role.refresh_from_db()
    assert target_role.permissions == ["sales.invoice.create"]


@pytest.mark.django_db
def test_reject_leaves_target_unchanged(back_office_admin, target_role):
    original_permissions = list(target_role.permissions)
    client = APIClient()
    client.force_authenticate(user=back_office_admin)
    propose_response = _propose(client, target_role, {"permissions": ["sales.invoice.create"]})

    reject_response = client.post(
        f"/api/governance/change-requests/{propose_response.data['id']}/reject/", {"note": "not now"}, format="json"
    )
    assert reject_response.status_code == 200
    assert reject_response.data["status"] == "rejected"

    target_role.refresh_from_db()
    assert target_role.permissions == original_permissions


@pytest.mark.django_db
def test_already_reviewed_change_request_cannot_be_reviewed_again(back_office_admin, target_role):
    client = APIClient()
    client.force_authenticate(user=back_office_admin)
    propose_response = _propose(client, target_role, {"permissions": ["sales.invoice.create"]})
    change_request_id = propose_response.data["id"]

    first_approval = client.post(f"/api/governance/change-requests/{change_request_id}/approve/", format="json")
    assert first_approval.status_code == 200

    second_approval = client.post(f"/api/governance/change-requests/{change_request_id}/approve/", format="json")
    assert second_approval.status_code == 400

    reject_after_approve = client.post(f"/api/governance/change-requests/{change_request_id}/reject/", format="json")
    assert reject_after_approve.status_code == 400


@pytest.mark.django_db
def test_field_agent_cannot_list_change_requests(agent):
    client = APIClient()
    client.force_authenticate(user=agent)
    response = client.get("/api/governance/change-requests/")
    assert response.status_code == 403
