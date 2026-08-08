"""Registers Role with apps.governance's ChangeRequest workflow — see
apps.governance.services. Imported from AccountsConfig.ready() so the
registration runs exactly once, after the app registry is populated."""

from apps.governance.services import register_governed_model

from .models import Role

ROLE_GOVERNED_FIELDS = ["permissions", "is_active"]


def _apply_role_change(role, changes):
    fields = [field for field in ROLE_GOVERNED_FIELDS if field in changes]
    for field in fields:
        setattr(role, field, changes[field])
    if fields:
        role.save(update_fields=fields)


def register():
    register_governed_model("role", Role, _apply_role_change, ROLE_GOVERNED_FIELDS)
