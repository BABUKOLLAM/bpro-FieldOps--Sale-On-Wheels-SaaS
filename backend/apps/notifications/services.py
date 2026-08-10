import json
import urllib.error
import urllib.request

from django.conf import settings

from .models import DeviceToken, MessageTemplate, NotificationGatewaySettings, NotificationLog, SmsLog, WhatsAppLog

FCM_SEND_URL = "https://fcm.googleapis.com/fcm/send"
WHATSAPP_API_VERSION = "v19.0"

# The exact strings each call site hardcoded before MessageTemplate
# existed — used as a fallback so a deployment with no Master Settings
# edit yet behaves identically to before this model existed. Keep these
# in sync with MessageTemplate.seed_defaults() below.
DEFAULT_TEMPLATES = {
    MessageTemplate.KEY_EXPENSE_APPROVED: ("Expense approved", "Your {category} expense of ₹{amount} was approved."),
    MessageTemplate.KEY_EXPENSE_REJECTED: ("Expense rejected", "Your {category} expense of ₹{amount} was rejected."),
    MessageTemplate.KEY_DELIVERY_OTP: (
        "", "Your OTP to confirm delivery of invoice {invoice_no} is {code}. Valid for {validity_minutes} minutes.",
    ),
    MessageTemplate.KEY_INVOICE_READY_WHATSAPP: (
        "", "Hi {customer_name}, your invoice {invoice_no} dated {invoice_date} for Rs. {amount} has been generated. Thank you for your business!",
    ),
}


def render_template(key: str, **kwargs) -> tuple[str, str]:
    template = MessageTemplate.objects.filter(key=key).first()
    if template is not None:
        return template.render(**kwargs)
    title, body = DEFAULT_TEMPLATES[key]
    return title.format(**kwargs), body.format(**kwargs)


def _resolve_gateway_setting(db_field: str, settings_key: str) -> str:
    """DB-backed Master Settings override (apps.notifications.
    NotificationGatewaySettings) takes precedence when set; otherwise
    falls back to the env var exactly as before that model existed. Uses
    .first() (not get_solo()) so calling this doesn't provision a row
    just because a notification was sent."""
    gateway_settings = NotificationGatewaySettings.objects.first()
    db_value = getattr(gateway_settings, db_field, "") if gateway_settings else ""
    return db_value or getattr(settings, settings_key, "")


def send_push_notification(user, title: str, body: str, data: dict | None = None) -> NotificationLog:
    """FR-18 push notifications. Mirrors apps.reporting's email pattern:
    no FCM_SERVER_KEY configured -> print to console instead of faking a
    "sent" result, but still return/log a real NotificationLog row so
    the attempt is auditable either way. Delivers to every active
    DeviceToken the user has registered."""
    data = data or {}
    tokens = list(DeviceToken.objects.filter(user=user, is_active=True).values_list("token", flat=True))

    server_key = _resolve_gateway_setting("fcm_server_key", "FCM_SERVER_KEY")
    if not server_key or not tokens:
        channel = NotificationLog.CHANNEL_CONSOLE
        print(f"[push:console] to={user} title={title!r} body={body!r} data={data} tokens={len(tokens)}")
    else:
        channel = NotificationLog.CHANNEL_FCM
        for token in tokens:
            payload = json.dumps({
                "to": token,
                "notification": {"title": title, "body": body},
                "data": data,
            }).encode("utf-8")
            request = urllib.request.Request(
                FCM_SEND_URL, data=payload, method="POST",
                headers={"Authorization": f"key={server_key}", "Content-Type": "application/json"},
            )
            try:
                urllib.request.urlopen(request, timeout=10)
            except urllib.error.URLError:
                # A single unreachable/invalid token must not block the
                # rest, or fail the caller's own transaction (e.g. an
                # expense approval) over a notification side-effect.
                continue

    return NotificationLog.objects.create(
        user=user, title=title, body=body, data=data, channel=channel, device_count=len(tokens),
    )


def send_sms(phone: str, message: str) -> SmsLog:
    """FR-12 OTP proof-of-delivery (and any future SMS need). Same
    console-fallback shape as send_push_notification/email: no
    SMS_GATEWAY_URL configured -> print instead of faking delivery,
    generic enough to point at any REST-based SMS gateway once a vendor
    is chosen (the BRD doesn't name one)."""
    gateway_url = _resolve_gateway_setting("sms_gateway_url", "SMS_GATEWAY_URL")
    api_key = _resolve_gateway_setting("sms_gateway_api_key", "SMS_GATEWAY_API_KEY")

    if not gateway_url:
        channel = SmsLog.CHANNEL_CONSOLE
        print(f"[sms:console] to={phone} message={message!r}")
    else:
        channel = SmsLog.CHANNEL_GATEWAY
        payload = json.dumps({"to": phone, "message": message, "api_key": api_key}).encode("utf-8")
        request = urllib.request.Request(
            gateway_url, data=payload, method="POST", headers={"Content-Type": "application/json"},
        )
        try:
            urllib.request.urlopen(request, timeout=10)
        except urllib.error.URLError:
            channel = SmsLog.CHANNEL_CONSOLE
            print(f"[sms:console-fallback-on-error] to={phone} message={message!r}")

    return SmsLog.objects.create(phone=phone, message=message, channel=channel)


def send_whatsapp(phone: str, message: str) -> WhatsAppLog:
    """WhatsApp Business Cloud API (Meta Graph API) sender. Same
    console-fallback shape as send_sms: no phone_number_id/access_token
    configured -> print instead of faking delivery. `phone` must be in
    international format (e.g. "919876543210", no leading +) per the
    Cloud API's requirement."""
    phone_number_id = _resolve_gateway_setting("whatsapp_phone_number_id", "WHATSAPP_PHONE_NUMBER_ID")
    access_token = _resolve_gateway_setting("whatsapp_access_token", "WHATSAPP_ACCESS_TOKEN")

    if not phone_number_id or not access_token:
        channel = WhatsAppLog.CHANNEL_CONSOLE
        print(f"[whatsapp:console] to={phone} message={message!r}")
    else:
        channel = WhatsAppLog.CHANNEL_GATEWAY
        api_url = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{phone_number_id}/messages"
        payload = json.dumps({
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "text",
            "text": {"body": message},
        }).encode("utf-8")
        request = urllib.request.Request(
            api_url, data=payload, method="POST",
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
        )
        try:
            urllib.request.urlopen(request, timeout=10)
        except urllib.error.URLError:
            channel = WhatsAppLog.CHANNEL_CONSOLE
            print(f"[whatsapp:console-fallback-on-error] to={phone} message={message!r}")

    return WhatsAppLog.objects.create(phone=phone, message=message, channel=channel)
