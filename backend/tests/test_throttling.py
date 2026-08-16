from unittest.mock import patch

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

pytestmark = pytest.mark.django_db


# override_settings(REST_FRAMEWORK={...}) is NOT usable here: DRF's
# SimpleRateThrottle binds THROTTLE_RATES as a class attribute at import
# time, so once any earlier test in the session has triggered the first
# request (importing the throttling module with the real rates), a
# settings override no longer reaches it — the test would then pass when
# run alone and fail in the full suite purely on import order.
# patch.dict on the live class attribute is order-independent.
def test_login_throttled_after_limit():
    cache.clear()  # throttle counters persist in the test cache otherwise
    client = APIClient()
    with patch.dict(ScopedRateThrottle.THROTTLE_RATES, {"login": "3/min"}):
        for _ in range(3):
            resp = client.post(
                "/api/auth/login/",
                {"username": "nobody@nowhere.test", "password": "wrong"},
                format="json",
            )
            assert resp.status_code == 401
        resp = client.post(
            "/api/auth/login/",
            {"username": "nobody@nowhere.test", "password": "wrong"},
            format="json",
        )
        assert resp.status_code == 429
    cache.clear()


def test_login_not_throttled_at_normal_rates():
    cache.clear()
    client = APIClient()
    resp = client.post(
        "/api/auth/login/",
        {"username": "nobody@nowhere.test", "password": "wrong"},
        format="json",
    )
    assert resp.status_code == 401
    cache.clear()
