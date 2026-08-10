"""JWT auth for PlatformAdmin — a control-plane identity, separate from
any tenant's own apps.accounts.User (see PlatformAdmin's docstring), so
it needs its own token issuance and a custom authentication class rather
than reusing apps.accounts.LoginSerializer or the default
JWTAuthentication (both hardcoded to AUTH_USER_MODEL = "accounts.User").

Token issuance deliberately does NOT use RefreshToken.for_user(): with
rest_framework_simplejwt.token_blacklist installed (it is, for the
regular accounts.User flow), for_user() creates an OutstandingToken row
whose `user` FK is hardcoded to AUTH_USER_MODEL — it raises a ValueError
for any other model, PlatformAdmin included. Building the token by hand
(a bare RefreshToken() with the user-id/platform claims set directly)
sidesteps that FK entirely; no blacklist tracking exists for platform
tokens, same as no OutstandingToken existed for anyone before that app
was added. The "platform_admin" claim is what tells
PlatformAdminJWTAuthentication to look up a PlatformAdmin instead of the
default accounts.User, and what stops a regular tenant user's token from
ever being accepted on the platform namespace (or vice versa)."""

from rest_framework.permissions import BasePermission
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken

from .models import PlatformAdmin

PLATFORM_TOKEN_CLAIM = "platform_admin"


def tokens_for_platform_admin(admin: PlatformAdmin) -> dict:
    refresh = RefreshToken()
    refresh[api_settings.USER_ID_CLAIM] = str(getattr(admin, api_settings.USER_ID_FIELD))
    refresh[PLATFORM_TOKEN_CLAIM] = True
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


class PlatformAdminJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        if not validated_token.get(PLATFORM_TOKEN_CLAIM):
            raise InvalidToken("Not a platform admin token.")
        try:
            return PlatformAdmin.objects.get(pk=validated_token["user_id"], is_active=True)
        except PlatformAdmin.DoesNotExist:
            raise InvalidToken("Platform admin not found or inactive.")


class IsPlatformAdmin(BasePermission):
    def has_permission(self, request, view):
        return isinstance(request.user, PlatformAdmin) and request.user.is_active
