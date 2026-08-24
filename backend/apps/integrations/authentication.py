import hashlib
import hmac
import time

from django.conf import settings
from django.core.cache import cache
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

# How far a request's timestamp may drift from server time before it's
# rejected, and how long a nonce is remembered. The nonce TTL must be
# comfortably larger than the window: a replayed request is caught either
# by the timestamp (outside the window) or by the nonce cache (inside it).
SIGNATURE_WINDOW_SECONDS = 300
NONCE_TTL_SECONDS = 900


class ConnectorAgentUser:
    """A non-Django-User principal representing the on-prem connector
    agent process — it authenticates with the shared deployment key
    (settings.CONNECTOR_API_KEY), not a user account or JWT."""

    is_authenticated = True
    is_superuser = False
    # DRF's UserRateThrottle keys authenticated requests on user.pk —
    # a stable sentinel keeps the default throttles working now that
    # these requests are actually authenticated (not anonymous).
    pk = "connector-agent"

    def __str__(self):
        return "connector-agent"


def build_connector_signature(key: str, timestamp: str, nonce: str, method: str, path: str, body: bytes) -> str:
    """HMAC-SHA256 over everything that identifies one specific request.
    Shared contract with connector_agent/agent.py — both sides must
    compute the exact same string."""
    body_hash = hashlib.sha256(body or b"").hexdigest()
    message = f"{timestamp}.{nonce}.{method.upper()}.{path}.{body_hash}"
    return hmac.new(key.encode(), message.encode(), hashlib.sha256).hexdigest()


class ConnectorAPIKeyAuthentication(BaseAuthentication):
    """Used only by apps.integrations.views.ConnectorJobViewSet — the
    endpoints the on-prem Tally connector agent polls (see BRD 11.4).

    Requests must be SIGNED, not just keyed: a static key header alone
    can be replayed verbatim by anyone who ever captures one request.
    The agent sends a timestamp + single-use nonce + HMAC-SHA256 (keyed
    with CONNECTOR_API_KEY) over method/path/body, so a captured request
    is useless outside the timestamp window, can't be re-sent inside it
    (nonce cache), and can't be altered (body hash is signed).

    CONNECTOR_ALLOW_UNSIGNED=1 permits the legacy plain-key header alone
    — only meant to bridge an already-deployed agent that hasn't been
    updated yet, never for a fresh deployment. All key comparisons are
    constant-time (hmac.compare_digest), never `!=`.
    """

    def authenticate(self, request):
        provided_key = request.headers.get("X-Connector-Key")
        if not provided_key:
            return None

        configured_key = settings.CONNECTOR_API_KEY
        if not configured_key or not hmac.compare_digest(provided_key, configured_key):
            raise AuthenticationFailed("Invalid connector API key.")

        signature = request.headers.get("X-Connector-Signature", "")
        if not signature:
            if getattr(settings, "CONNECTOR_ALLOW_UNSIGNED", False):
                return (ConnectorAgentUser(), None)
            raise AuthenticationFailed(
                "Signed connector requests are required (X-Connector-Signature missing). "
                "Update the connector agent, or set CONNECTOR_ALLOW_UNSIGNED=1 to bridge "
                "an old agent temporarily."
            )

        timestamp = request.headers.get("X-Connector-Timestamp", "")
        nonce = request.headers.get("X-Connector-Nonce", "")
        if not timestamp or not nonce:
            raise AuthenticationFailed("Connector signature headers incomplete.")

        try:
            skew = abs(time.time() - int(timestamp))
        except ValueError:
            raise AuthenticationFailed("Connector timestamp is not a valid unix timestamp.")
        if skew > SIGNATURE_WINDOW_SECONDS:
            raise AuthenticationFailed("Connector request timestamp outside the allowed window.")

        expected = build_connector_signature(
            configured_key, timestamp, nonce, request.method, request.path, request.body
        )
        if not hmac.compare_digest(signature, expected):
            raise AuthenticationFailed("Connector signature mismatch.")

        # cache.add is atomic: False means this nonce was already used —
        # i.e. an exact replay inside the timestamp window.
        if not cache.add(f"connector-nonce:{nonce}", 1, timeout=NONCE_TTL_SECONDS):
            raise AuthenticationFailed("Connector nonce already used (replay rejected).")

        return (ConnectorAgentUser(), None)
