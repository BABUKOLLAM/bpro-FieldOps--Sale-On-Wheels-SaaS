"""Registers PaymentGatewayConnection with apps.governance's ChangeRequest
workflow — see apps.governance.services. Imported from
PaymentsConfig.ready(). `credentials` is deliberately excluded from the
governed-fields list — same reasoning as apps.integrations.governance:
a ChangeRequest's proposed_changes/previous_snapshot are plain JSON, not
encrypted at rest."""

from apps.governance.services import register_governed_model

from .models import PaymentGatewayConnection

PAYMENT_GATEWAY_CONNECTION_GOVERNED_FIELDS = ["gateway_type", "is_active"]


def _apply_payment_gateway_connection_change(connection, changes):
    fields = [field for field in PAYMENT_GATEWAY_CONNECTION_GOVERNED_FIELDS if field in changes]
    for field in fields:
        setattr(connection, field, changes[field])
    if fields:
        connection.save(update_fields=fields)


def register():
    register_governed_model(
        "payment-gateway-connection", PaymentGatewayConnection,
        _apply_payment_gateway_connection_change, PAYMENT_GATEWAY_CONNECTION_GOVERNED_FIELDS,
    )
