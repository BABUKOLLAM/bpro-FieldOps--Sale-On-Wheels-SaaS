from django.core.exceptions import ValidationError
from django.db import models

from apps.core.encryption import decrypt_json, encrypt_json
from apps.core.models import BaseModel


class DeviceToken(BaseModel):
    """FR-18 push notifications: a mobile/web push token registered by a
    user's device. `provider` records which push service issued the
    token (only FCM is wired up to actually send today — see
    apps.notifications.services — but the shape allows adding APNs/web-
    push later without a migration)."""

    PLATFORM_ANDROID = "android"
    PLATFORM_IOS = "ios"
    PLATFORM_WEB = "web"
    PLATFORM_CHOICES = [
        (PLATFORM_ANDROID, "Android"), (PLATFORM_IOS, "iOS"), (PLATFORM_WEB, "Web"),
    ]

    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="device_tokens")
    token = models.CharField(max_length=255, unique=True)
    platform = models.CharField(max_length=10, choices=PLATFORM_CHOICES)
    provider = models.CharField(max_length=20, default="fcm")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.user} — {self.platform} ({self.token[:12]}…)"


class NotificationLog(BaseModel):
    """A record of every push notification the system attempted to send,
    regardless of whether a real FCM credential was configured — mirrors
    apps.reporting's email-log-via-console-backend pattern: nothing here
    is faked as "sent" when it wasn't, but every attempt is auditable."""

    CHANNEL_FCM = "fcm"
    CHANNEL_CONSOLE = "console"
    CHANNEL_CHOICES = [(CHANNEL_FCM, "FCM"), (CHANNEL_CONSOLE, "Console (no FCM configured)")]

    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, null=True, blank=True, related_name="notification_logs",
    )
    title = models.CharField(max_length=200)
    body = models.TextField()
    data = models.JSONField(default=dict, blank=True)
    channel = models.CharField(max_length=10, choices=CHANNEL_CHOICES)
    device_count = models.PositiveIntegerField(default=0, help_text="How many of the user's active tokens this went to.")

    def __str__(self):
        return f"{self.title} → {self.user}"


class SmsLog(BaseModel):
    """A record of every SMS the system attempted to send (FR-12 OTP
    proof-of-delivery today; usable for any future SMS need). Same
    console-fallback auditability as NotificationLog/push — see
    apps.notifications.services.send_sms."""

    CHANNEL_GATEWAY = "gateway"
    CHANNEL_CONSOLE = "console"
    CHANNEL_CHOICES = [(CHANNEL_GATEWAY, "SMS gateway"), (CHANNEL_CONSOLE, "Console (no gateway configured)")]

    phone = models.CharField(max_length=20)
    message = models.TextField()
    channel = models.CharField(max_length=10, choices=CHANNEL_CHOICES)

    def __str__(self):
        return f"SMS → {self.phone}"


class NotificationGatewaySettings(BaseModel):
    """Singleton row holding DB-backed overrides for the FCM/SMS gateway
    config that used to be env-var-only (settings.FCM_SERVER_KEY,
    settings.SMS_GATEWAY_URL, settings.SMS_GATEWAY_API_KEY). A blank
    field here falls back to the env var — see
    apps.notifications.services._resolve_gateway_setting — so a fresh
    deployment with no Master Settings edit yet keeps working exactly as
    before this model existed. Same singleton posture as
    apps.company.Company; same Fernet-at-rest posture for the two secret
    fields as apps.integrations.ERPConnection.credentials."""

    sms_gateway_url = models.URLField(blank=True)
    _fcm_server_key_encrypted = models.TextField(blank=True, db_column="fcm_server_key_encrypted")
    _sms_gateway_api_key_encrypted = models.TextField(blank=True, db_column="sms_gateway_api_key_encrypted")

    def clean(self):
        if NotificationGatewaySettings.objects.exclude(pk=self.pk).exists():
            raise ValidationError("Only one NotificationGatewaySettings record is permitted per deployment.")

    def __str__(self):
        return "Notification Gateway Settings"

    @classmethod
    def get_solo(cls):
        obj = cls.objects.first()
        return obj if obj is not None else cls.objects.create()

    @property
    def fcm_server_key(self) -> str:
        return decrypt_json(self._fcm_server_key_encrypted).get("value", "")

    @fcm_server_key.setter
    def fcm_server_key(self, value: str):
        self._fcm_server_key_encrypted = encrypt_json({"value": value}) if value else ""

    @property
    def sms_gateway_api_key(self) -> str:
        return decrypt_json(self._sms_gateway_api_key_encrypted).get("value", "")

    @sms_gateway_api_key.setter
    def sms_gateway_api_key(self, value: str):
        self._sms_gateway_api_key_encrypted = encrypt_json({"value": value}) if value else ""


class MessageTemplate(BaseModel):
    """DB-backed override for a notification's title/body, replacing what
    used to be a hardcoded f-string at each call site (expense approved/
    rejected, delivery OTP). `key` identifies which call site — see
    apps.notifications.services.render_template, which looks up a row by
    key and falls back to the exact original hardcoded string (via
    DEFAULT_TEMPLATES) when no row exists yet or a deployment hasn't
    edited it, so nothing changes in behavior until someone actually
    edits a template through Master Settings. Placeholders use Python's
    str.format() syntax, e.g. "{amount}"."""

    KEY_EXPENSE_APPROVED = "expense_approved"
    KEY_EXPENSE_REJECTED = "expense_rejected"
    KEY_DELIVERY_OTP = "delivery_otp"
    KEY_CHOICES = [
        (KEY_EXPENSE_APPROVED, "Expense approved (push)"),
        (KEY_EXPENSE_REJECTED, "Expense rejected (push)"),
        (KEY_DELIVERY_OTP, "Delivery OTP (SMS)"),
    ]

    key = models.CharField(max_length=50, choices=KEY_CHOICES, unique=True)
    title_template = models.CharField(
        max_length=200, blank=True, help_text="Push notification title. Leave blank for SMS-only templates.",
    )
    body_template = models.TextField()

    def __str__(self):
        return self.get_key_display()

    def render(self, **kwargs) -> tuple[str, str]:
        return self.title_template.format(**kwargs), self.body_template.format(**kwargs)

    @classmethod
    def seed_defaults(cls):
        """Idempotent, same convention as apps.accounts.Role.seed_defaults
        — populates any KEY_CHOICES row that doesn't exist yet from
        apps.notifications.services.DEFAULT_TEMPLATES (imported here, not
        at module level, to avoid a circular import), never overwrites an
        already-seeded/edited row."""
        from .services import DEFAULT_TEMPLATES

        for key, (title, body) in DEFAULT_TEMPLATES.items():
            cls.objects.get_or_create(key=key, defaults={"title_template": title, "body_template": body})
