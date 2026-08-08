from django.db import models

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
