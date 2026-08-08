"""Registers NotificationGatewaySettings with apps.governance's
ChangeRequest workflow — see apps.governance.services. Imported from
NotificationsConfig.ready(). Only sms_gateway_url is governed — the two
secret fields (fcm_server_key, sms_gateway_api_key) are deliberately
excluded, same reasoning as apps.integrations.governance: a
ChangeRequest's proposed_changes/previous_snapshot are plain JSON, not
encrypted at rest, so no secret should ever pass through this generic
diff flow. Rotate those two via Django admin/shell instead."""

from apps.governance.services import register_governed_model

from .models import NotificationGatewaySettings

NOTIFICATION_GATEWAY_SETTINGS_GOVERNED_FIELDS = ["sms_gateway_url"]


def _apply_notification_gateway_settings_change(settings_row, changes):
    fields = [field for field in NOTIFICATION_GATEWAY_SETTINGS_GOVERNED_FIELDS if field in changes]
    for field in fields:
        setattr(settings_row, field, changes[field])
    if fields:
        settings_row.save(update_fields=fields)


def register():
    register_governed_model(
        "notification-gateway-settings", NotificationGatewaySettings,
        _apply_notification_gateway_settings_change, NOTIFICATION_GATEWAY_SETTINGS_GOVERNED_FIELDS,
    )
