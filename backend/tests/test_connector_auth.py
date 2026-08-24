"""Connector-endpoint authentication: the unauthenticated-access
regression (permission_classes=[] made the endpoints public), plus the
signed-request scheme (timestamp window, single-use nonce, HMAC over
method/path/body) and result idempotency."""
import time
import uuid

from django.core.cache import cache
from rest_framework.test import APIClient

import pytest

from apps.integrations.authentication import build_connector_signature
from apps.integrations.models import SyncLogEntry

pytestmark = pytest.mark.django_db

JOBS_PATH = "/api/integrations/connector/jobs/"
TEST_KEY = "test-connector-key"


@pytest.fixture(autouse=True)
def connector_key(settings):
    settings.CONNECTOR_API_KEY = TEST_KEY
    # Each test gets a clean nonce store.
    cache.clear()


def _signed_headers(method, path, body=b"", *, key=TEST_KEY, timestamp=None, nonce=None):
    timestamp = timestamp or str(int(time.time()))
    nonce = nonce or uuid.uuid4().hex
    signature = build_connector_signature(key, timestamp, nonce, method, path, body)
    return {
        "HTTP_X_CONNECTOR_KEY": key,
        "HTTP_X_CONNECTOR_TIMESTAMP": timestamp,
        "HTTP_X_CONNECTOR_NONCE": nonce,
        "HTTP_X_CONNECTOR_SIGNATURE": signature,
    }


def test_no_credentials_at_all_is_rejected():
    """Regression: with permission_classes=[] this returned 200 to
    anonymous — every pending sync-job payload was publicly readable."""
    resp = APIClient().get(JOBS_PATH)
    assert resp.status_code in (401, 403)


def test_wrong_key_is_rejected():
    resp = APIClient().get(JOBS_PATH, HTTP_X_CONNECTOR_KEY="wrong-key")
    assert resp.status_code in (401, 403)


def test_plain_key_without_signature_is_rejected_by_default():
    resp = APIClient().get(JOBS_PATH, HTTP_X_CONNECTOR_KEY=TEST_KEY)
    assert resp.status_code in (401, 403)


def test_plain_key_accepted_only_with_explicit_legacy_flag(settings):
    settings.CONNECTOR_ALLOW_UNSIGNED = True
    resp = APIClient().get(JOBS_PATH, HTTP_X_CONNECTOR_KEY=TEST_KEY)
    assert resp.status_code == 200


def test_correctly_signed_request_is_accepted():
    resp = APIClient().get(JOBS_PATH, **_signed_headers("GET", JOBS_PATH))
    assert resp.status_code == 200


def test_stale_timestamp_is_rejected():
    stale = str(int(time.time()) - 3600)
    resp = APIClient().get(JOBS_PATH, **_signed_headers("GET", JOBS_PATH, timestamp=stale))
    assert resp.status_code in (401, 403)


def test_nonce_replay_is_rejected():
    headers = _signed_headers("GET", JOBS_PATH)
    first = APIClient().get(JOBS_PATH, **headers)
    assert first.status_code == 200
    replay = APIClient().get(JOBS_PATH, **headers)
    assert replay.status_code in (401, 403)


def test_signature_over_wrong_path_is_rejected():
    headers = _signed_headers("GET", "/api/some/other/path/")
    resp = APIClient().get(JOBS_PATH, **headers)
    assert resp.status_code in (401, 403)


def test_result_is_idempotent_once_decided():
    entry = SyncLogEntry.objects.create(
        entity_type="invoice", local_object_id=uuid.uuid4(),
        status=SyncLogEntry.STATUS_PENDING,
    )
    path = f"{JOBS_PATH}{entry.id}/result/"
    body = b'{"status": "acknowledged", "erp_reference_id": "TALLY-1"}'
    resp = APIClient().post(
        path, data=body, content_type="application/json", **_signed_headers("POST", path, body)
    )
    assert resp.status_code == 200
    entry.refresh_from_db()
    assert entry.status == SyncLogEntry.STATUS_ACKNOWLEDGED
    assert entry.erp_reference_id == "TALLY-1"

    # A late/duplicate "failed" must not overwrite the recorded ack.
    body2 = b'{"status": "failed", "error_message": "stale duplicate"}'
    resp2 = APIClient().post(
        path, data=body2, content_type="application/json", **_signed_headers("POST", path, body2)
    )
    assert resp2.status_code == 200
    entry.refresh_from_db()
    assert entry.status == SyncLogEntry.STATUS_ACKNOWLEDGED
    assert entry.erp_reference_id == "TALLY-1"
