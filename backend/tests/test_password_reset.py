import re
from urllib.parse import parse_qs, urlsplit

from django.core import mail
from rest_framework.test import APIClient

import pytest

from apps.accounts.models import User

pytestmark = pytest.mark.django_db


@pytest.fixture
def existing_user(db):
    return User.objects.create_user(
        username="priya@example.com", email="priya@example.com", password="OldPass#123"
    )


def _extract_uid_token(email_body):
    url = re.search(r"https?://\S+/set-password\?\S+", email_body).group(0)
    query = parse_qs(urlsplit(url).query)
    return query["uid"][0], query["token"][0]


def test_request_by_email_sends_link_and_old_password_still_works_until_reset(existing_user):
    resp = APIClient().post("/api/auth/password-reset/", {"email": "priya@example.com"}, format="json")
    assert resp.status_code == 200

    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["priya@example.com"]
    assert "set-password" in mail.outbox[0].body

    # Requesting a reset link doesn't itself change anything.
    existing_user.refresh_from_db()
    assert existing_user.check_password("OldPass#123")


def test_request_by_username_also_works_when_it_differs_from_email():
    User.objects.create_user(username="p.sharma", email="priya2@example.com", password="OldPass#123")
    resp = APIClient().post("/api/auth/password-reset/", {"email": "p.sharma"}, format="json")
    assert resp.status_code == 200
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["priya2@example.com"]


def test_unknown_email_returns_same_generic_response_and_sends_nothing():
    resp = APIClient().post("/api/auth/password-reset/", {"email": "nobody@example.com"}, format="json")
    assert resp.status_code == 200
    assert resp.data["detail"] == "If that account exists, a password reset link has been sent."
    assert len(mail.outbox) == 0


def test_full_reset_round_trip_replaces_the_old_password(existing_user):
    resp = APIClient().post("/api/auth/password-reset/", {"email": "priya@example.com"}, format="json")
    uid, token = _extract_uid_token(mail.outbox[0].body)

    confirm = APIClient().post(
        "/api/auth/set-password/", {"uid": uid, "token": token, "password": "Br4nd#NewPass"}, format="json"
    )
    assert confirm.status_code == 200

    existing_user.refresh_from_db()
    assert existing_user.check_password("Br4nd#NewPass")
    assert not existing_user.check_password("OldPass#123")

    # The link is single-use, same as the signup-approval flow.
    replay = APIClient().post(
        "/api/auth/set-password/", {"uid": uid, "token": token, "password": "Ano7her#Pass"}, format="json"
    )
    assert replay.status_code == 400


def test_inactive_user_gets_generic_response_and_no_email(existing_user):
    existing_user.is_active = False
    existing_user.save(update_fields=["is_active"])

    resp = APIClient().post("/api/auth/password-reset/", {"email": "priya@example.com"}, format="json")
    assert resp.status_code == 200
    assert len(mail.outbox) == 0


def test_lookup_returns_the_account_a_valid_link_belongs_to(existing_user):
    APIClient().post("/api/auth/password-reset/", {"email": "priya@example.com"}, format="json")
    uid, token = _extract_uid_token(mail.outbox[0].body)

    resp = APIClient().get("/api/auth/set-password/lookup/", {"uid": uid, "token": token})
    assert resp.status_code == 200
    assert resp.data == {"username": "priya@example.com", "email": "priya@example.com"}


def test_lookup_rejects_a_bad_token(existing_user):
    APIClient().post("/api/auth/password-reset/", {"email": "priya@example.com"}, format="json")
    uid, _token = _extract_uid_token(mail.outbox[0].body)

    resp = APIClient().get("/api/auth/set-password/lookup/", {"uid": uid, "token": "not-a-real-token"})
    assert resp.status_code == 400


def test_lookup_no_longer_matches_once_the_password_has_been_set(existing_user):
    APIClient().post("/api/auth/password-reset/", {"email": "priya@example.com"}, format="json")
    uid, token = _extract_uid_token(mail.outbox[0].body)

    APIClient().post(
        "/api/auth/set-password/", {"uid": uid, "token": token, "password": "Br4nd#NewPass"}, format="json"
    )

    resp = APIClient().get("/api/auth/set-password/lookup/", {"uid": uid, "token": token})
    assert resp.status_code == 400
