import json
import urllib.error
import urllib.request

from django.conf import settings

from .models import DeviceToken, NotificationLog

FCM_SEND_URL = "https://fcm.googleapis.com/fcm/send"


def send_push_notification(user, title: str, body: str, data: dict | None = None) -> NotificationLog:
    """FR-18 push notifications. Mirrors apps.reporting's email pattern:
    no FCM_SERVER_KEY configured -> print to console instead of faking a
    "sent" result, but still return/log a real NotificationLog row so
    the attempt is auditable either way. Delivers to every active
    DeviceToken the user has registered."""
    data = data or {}
    tokens = list(DeviceToken.objects.filter(user=user, is_active=True).values_list("token", flat=True))

    server_key = getattr(settings, "FCM_SERVER_KEY", "")
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
