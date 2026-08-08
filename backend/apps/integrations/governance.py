"""Registers ERPConnection and Webhook with apps.governance's
ChangeRequest workflow — see apps.governance.services. Imported from
IntegrationsConfig.ready(). Secret-bearing fields (ERPConnection never
exposed `credentials` on its serializer at all; Webhook's `secret`) are
deliberately excluded from both governed-fields lists — a ChangeRequest's
proposed_changes/previous_snapshot are plain JSON, not encrypted at rest,
so no secret should ever pass through this generic diff flow."""

from apps.governance.services import register_governed_model

from .models import ERPConnection, Webhook

ERP_CONNECTION_GOVERNED_FIELDS = ["erp_type", "sync_mode", "batch_interval_minutes", "is_active"]
WEBHOOK_GOVERNED_FIELDS = ["name", "url", "event_types", "is_active"]


def _apply_change(instance, changes, governed_fields):
    fields = [field for field in governed_fields if field in changes]
    for field in fields:
        setattr(instance, field, changes[field])
    if fields:
        instance.save(update_fields=fields)


def _apply_erp_connection_change(connection, changes):
    _apply_change(connection, changes, ERP_CONNECTION_GOVERNED_FIELDS)


def _apply_webhook_change(webhook, changes):
    _apply_change(webhook, changes, WEBHOOK_GOVERNED_FIELDS)


def register():
    register_governed_model(
        "erp-connection", ERPConnection, _apply_erp_connection_change, ERP_CONNECTION_GOVERNED_FIELDS,
    )
    register_governed_model("webhook", Webhook, _apply_webhook_change, WEBHOOK_GOVERNED_FIELDS)
