from decimal import Decimal, InvalidOperation


def _resolve_fk(col, raw):
    lookup = {col.fk_lookup: str(raw).strip()}
    try:
        return col.fk_model.objects.get(**lookup)
    except col.fk_model.DoesNotExist:
        if col.fk_create_if_missing:
            return col.fk_model.objects.create(**lookup)
        raise ValueError(f"{col.name} '{raw}' not found")


def _coerce(col, raw):
    if isinstance(raw, str):
        raw = raw.strip()
    if raw in (None, ""):
        if col.required:
            raise ValueError(f"'{col.name}' is required")
        return None if col.kind == "fk" else col.default
    if col.kind == "fk":
        return _resolve_fk(col, raw)
    if col.kind == "bool":
        return str(raw).strip().lower() in ("1", "true", "yes", "y")
    if col.kind == "decimal":
        try:
            return Decimal(str(raw))
        except InvalidOperation:
            raise ValueError(f"'{col.name}' must be a number, got '{raw}'")
    if col.kind == "int":
        try:
            return int(raw)
        except (TypeError, ValueError):
            raise ValueError(f"'{col.name}' must be a whole number, got '{raw}'")
    return str(raw)


def generic_import_row(spec, raw):
    """Single-key upsert: resolve every column (FKs by their lookup field,
    typed values by kind), then update_or_create keyed on the first
    key_columns entry. Blank optional cells clear/default the field on an
    existing record — an explicit, predictable overwrite rather than a
    partial patch."""
    key_col = next(c for c in spec.columns if c.field == spec.key_columns[0])
    key_value = _coerce(key_col, raw.get(key_col.name))
    if not key_value:
        raise ValueError(f"'{key_col.name}' is required")
    defaults = {}
    for col in spec.columns:
        if col.field == key_col.field:
            continue
        defaults[col.field] = _coerce(col, raw.get(col.name))
    obj, created = spec.model.objects.update_or_create(**{key_col.field: key_value}, defaults=defaults)
    return created, str(key_value)


def import_price_row(spec, raw):
    """Price list entries are keyed on (price_list, sku), not a single
    column. The price list is auto-created if it doesn't exist yet — the
    product referenced by sku must already exist."""
    from apps.catalog.models import Item, PriceList, PriceListItem

    price_list_name = (raw.get("price_list") or "").strip()
    sku = (raw.get("sku") or "").strip()
    rate_raw = raw.get("rate")
    if not price_list_name:
        raise ValueError("'price_list' is required")
    if not sku:
        raise ValueError("'sku' is required")
    if rate_raw in (None, ""):
        raise ValueError("'rate' is required")
    try:
        rate = Decimal(str(rate_raw).strip())
    except InvalidOperation:
        raise ValueError(f"'rate' must be a number, got '{rate_raw}'")
    price_list, _ = PriceList.objects.get_or_create(name=price_list_name)
    try:
        item = Item.objects.get(sku=sku)
    except Item.DoesNotExist:
        raise ValueError(f"product sku '{sku}' not found")
    obj, created = PriceListItem.objects.update_or_create(price_list=price_list, item=item, defaults={"rate": rate})
    return created, f"{price_list_name}/{sku}"


def import_staff_row(spec, raw):
    """Staff import needs bespoke handling for two columns the generic
    upsert can't cover: `password` (only touched when a value is given —
    a blank cell must never wipe an existing password) and `role` (an
    additive UserRole link, not a plain model field)."""
    from apps.accounts.models import Role, User, UserRole

    username = (raw.get("username") or "").strip()
    if not username:
        raise ValueError("'username' is required")
    defaults = {}
    for col in spec.columns:
        if col.field in ("username", "password", "role"):
            continue
        defaults[col.field] = _coerce(col, raw.get(col.name))
    obj, created = User.objects.update_or_create(username=username, defaults=defaults)
    password = (raw.get("password") or "").strip()
    if password:
        obj.set_password(password)
        obj.save(update_fields=["password"])
    elif created:
        obj.set_unusable_password()
        obj.save(update_fields=["password"])
    role_name = (raw.get("role") or "").strip()
    if role_name:
        try:
            role = Role.objects.get(name=role_name)
        except Role.DoesNotExist:
            raise ValueError(f"role '{role_name}' not found")
        UserRole.objects.get_or_create(user=obj, role=role)
    return created, username
