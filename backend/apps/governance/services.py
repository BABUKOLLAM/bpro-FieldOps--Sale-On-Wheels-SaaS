"""
Registry of models that go through the ChangeRequest approval workflow
instead of being edited directly. A model becomes "governed" by calling
register_governed_model() once, typically from its own app's
AppConfig.ready() — see apps.accounts.governance for the Role registration.

Deliberately an explicit allowlist keyed by both a client-facing slug and
the model class: apps.governance.views.ChangeRequestViewSet only ever
resolves a target through this registry, so a ChangeRequest can never be
pointed at an arbitrary model/field via a crafted target_type or
proposed_changes payload.
"""

_BY_SLUG = {}
_BY_MODEL = {}


def register_governed_model(slug, model, apply_handler, fields):
    entry = {"slug": slug, "model": model, "apply": apply_handler, "fields": list(fields)}
    _BY_SLUG[slug] = entry
    _BY_MODEL[model] = entry
    return entry


def get_by_slug(slug):
    return _BY_SLUG.get(slug)


def get_by_model(model):
    return _BY_MODEL.get(model)


def slug_for_model(model):
    entry = _BY_MODEL.get(model)
    return entry["slug"] if entry else None
