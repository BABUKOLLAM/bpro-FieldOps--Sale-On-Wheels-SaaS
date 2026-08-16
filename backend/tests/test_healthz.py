from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def test_healthz_ok_without_auth():
    resp = APIClient().get("/healthz/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["checks"] == {"database": "ok", "cache": "ok"}


def test_healthz_degraded_when_cache_down():
    with patch("apps.core.views.cache.set", side_effect=ConnectionError):
        resp = APIClient().get("/healthz/")
    assert resp.status_code == 503
    body = resp.json()
    assert body["status"] == "degraded"
    assert body["checks"]["cache"] == "error"
    assert body["checks"]["database"] == "ok"
