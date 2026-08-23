from rest_framework.test import APIClient

import pytest

from apps.accounts.constants import ROLE_FLEET_MANAGER, ROLE_VAN_SALESMAN
from apps.accounts.models import Role, User, UserRole
from apps.sales.models import SalesOrder

pytestmark = pytest.mark.django_db


def test_activate_reactivates_a_deactivated_user(back_office_admin, agent):
    client = APIClient()
    client.force_authenticate(user=back_office_admin)

    client.post(f"/api/users/{agent.id}/deactivate/")
    agent.refresh_from_db()
    assert not agent.is_active

    resp = client.post(f"/api/users/{agent.id}/activate/")
    assert resp.status_code == 200
    agent.refresh_from_db()
    assert agent.is_active


def test_deletable_true_and_delete_succeeds_for_a_user_with_no_history(back_office_admin):
    target = User.objects.create_user(username="unused@test.local", password="x")
    client = APIClient()
    client.force_authenticate(user=back_office_admin)

    detail = client.get(f"/api/users/{target.id}/").json()
    assert detail["deletable"] is True

    resp = client.delete(f"/api/users/{target.id}/")
    assert resp.status_code == 204
    assert not User.objects.filter(id=target.id).exists()


def test_deletable_false_and_delete_blocked_for_a_user_with_sales_history(back_office_admin, agent, customer):
    SalesOrder.objects.create(customer=customer, agent=agent, order_date="2026-01-01")

    client = APIClient()
    client.force_authenticate(user=back_office_admin)

    detail = client.get(f"/api/users/{agent.id}/").json()
    assert detail["deletable"] is False

    resp = client.delete(f"/api/users/{agent.id}/")
    assert resp.status_code == 400
    assert "deactivate" in resp.data["detail"].lower()
    assert User.objects.filter(id=agent.id).exists()


def test_user_can_hold_multiple_roles_and_one_can_be_removed_independently(back_office_admin, agent):
    # The `agent` fixture already assigns van_salesman — add a second
    # role on top of it to prove a user can hold more than one at once.
    Role.seed_defaults()
    fleet_role = Role.objects.get(name=ROLE_FLEET_MANAGER)
    second = UserRole.objects.create(user=agent, role=fleet_role)

    client = APIClient()
    client.force_authenticate(user=back_office_admin)

    detail = client.get(f"/api/users/{agent.id}/").json()
    assert sorted(detail["roles"]) == sorted([ROLE_VAN_SALESMAN, ROLE_FLEET_MANAGER])
    assignment_ids = {a["id"] for a in detail["role_assignments"]}
    assert str(second.id) in assignment_ids

    # Remove just the fleet-manager assignment, van salesman stays.
    resp = client.delete(f"/api/user-roles/{second.id}/")
    assert resp.status_code == 204

    detail = client.get(f"/api/users/{agent.id}/").json()
    assert detail["roles"] == [ROLE_VAN_SALESMAN]
