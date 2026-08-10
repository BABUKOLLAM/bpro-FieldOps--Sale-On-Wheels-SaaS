"""Registers NotificationGatewaySettings with apps.governance's
ChangeRequest workflow — see apps.governance.services. Imported from
NotificationsConfig.ready(). Only sms_gateway_url is governed — the two
secret fields (fcm_server_key, sms_gateway_api_key) are deliberately
excluded, same reasoning as apps.integrations.governance: a
ChangeRequest's proposed_changes/previous_snapshot are plain JSON, not
encrypted at rest, so no secret should ever pass through this generic
diff flow. Rotate those two via Django admin/shell instead."""

from apps.governance.services import register_governed_model

from .models import MessageTemplate, NotificationGatewaySettings

NOTIFICATION_GATEWAY_SETTINGS_GOVERNED_FIELDS = ["sms_gateway_url", "whatsapp_phone_number_id"]
MESSAGE_TEMPLATE_GOVERNED_FIELDS = ["title_template", "body_template"]


def _apply_change(instance, changes, governed_fields):
    fields = [field for field in governed_fields if field in changes]
    for field in fields:
        setattr(instance, field, changes[field])
    if fields:
        instance.save(update_fields=fields)


def _apply_notification_gateway_settings_change(settings_row, changes):
    _apply_change(settings_row, changes, NOTIFICATION_GATEWAY_SETTINGS_GOVERNED_FIELDS)


def _apply_message_template_change(template, changes):
    _apply_change(template, changes, MESSAGE_TEMPLATE_GOVERNED_FIELDS)


def register():
    register_governed_model(
        "notification-gateway-settings", NotificationGatewaySettings,
        _apply_notification_gateway_settings_change, NOTIFICATION_GATEWAY_SETTINGS_GOVERNED_FIELDS,
    )
    register_governed_model(
        "message-template", MessageTemplate, _apply_message_template_change, MESSAGE_TEMPLATE_GOVERNED_FIELDS,
    )
