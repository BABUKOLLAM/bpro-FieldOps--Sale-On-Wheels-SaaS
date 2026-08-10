"""Registers EwayBillSettings with apps.governance's ChangeRequest
workflow — see apps.governance.services. Imported from
SalesConfig.ready(). Mirrors apps.company.governance's pattern."""

from apps.governance.services import register_governed_model

from .models import EwayBillSettings

EWAY_BILL_SETTINGS_GOVERNED_FIELDS = ["threshold_amount", "is_active"]


def _apply_eway_bill_settings_change(instance, changes):
    fields = [field for field in EWAY_BILL_SETTINGS_GOVERNED_FIELDS if field in changes]
    for field in fields:
        setattr(instance, field, changes[field])
    if fields:
        instance.save(update_fields=fields)


def register():
    register_governed_model(
        "eway-bill-settings", EwayBillSettings, _apply_eway_bill_settings_change, EWAY_BILL_SETTINGS_GOVERNED_FIELDS,
    )
