"""Registers Company and GSTRegistration with apps.governance's
ChangeRequest workflow — see apps.governance.services. Imported from
CompanyConfig.ready(). default_godown is deliberately excluded from
Company's governed fields (an FK reassignment isn't a plain-value diff);
identity fields (gstin/state/company) stay editable here since, unlike
Role.name, a registration's own details legitimately change over time."""

from apps.governance.services import register_governed_model

from .models import Company, GSTRegistration

COMPANY_GOVERNED_FIELDS = ["legal_name", "display_name", "fy_start_month", "is_active", "upi_vpa"]
GST_REGISTRATION_GOVERNED_FIELDS = [
    "state", "gstin", "address_line1", "address_line2", "city", "pincode", "is_default",
]


def _apply_change(instance, changes, governed_fields):
    fields = [field for field in governed_fields if field in changes]
    for field in fields:
        setattr(instance, field, changes[field])
    if fields:
        instance.save(update_fields=fields)


def _apply_company_change(company, changes):
    _apply_change(company, changes, COMPANY_GOVERNED_FIELDS)


def _apply_gst_registration_change(registration, changes):
    _apply_change(registration, changes, GST_REGISTRATION_GOVERNED_FIELDS)


def register():
    register_governed_model("company", Company, _apply_company_change, COMPANY_GOVERNED_FIELDS)
    register_governed_model(
        "gst-registration", GSTRegistration, _apply_gst_registration_change, GST_REGISTRATION_GOVERNED_FIELDS,
    )
