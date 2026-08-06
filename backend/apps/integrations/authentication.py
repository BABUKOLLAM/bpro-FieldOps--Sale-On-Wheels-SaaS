from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


class ConnectorAgentUser:
    """A non-Django-User principal representing the on-prem connector
    agent process — it authenticates with a shared deployment-wide API
    key (settings.CONNECTOR_API_KEY), not a user account or JWT."""

    is_authenticated = True
    is_superuser = False

    def __str__(self):
        return "connector-agent"


class ConnectorAPIKeyAuthentication(BaseAuthentication):
    """Used only by apps.integrations.views.ConnectorJobViewSet — the
    endpoints the on-prem Tally connector agent polls. See BRD 11.4:
    credentials for this traffic are never stored on-device/on-agent
    beyond this one static key, and the connection is outbound-only HTTPS
    from the agent's side."""

    def authenticate(self, request):
        provided_key = request.headers.get("X-Connector-Key")
        if not provided_key:
            return None
        if not settings.CONNECTOR_API_KEY or provided_key != settings.CONNECTOR_API_KEY:
            raise AuthenticationFailed("Invalid connector API key.")
        return (ConnectorAgentUser(), None)
