from dataclasses import dataclass, field

from .row_importers import generic_import_row


def headers(spec):
    """Every column, including write-only ones — used for the downloadable
    template so an operator can see every field they're allowed to set."""
    return [c.name for c in spec.columns]


def export_headers(spec):
    """Only columns with real, safe data to show — used for actual data
    exports (excludes write-only columns like a password)."""
    return [c.name for c in spec.columns if c.include_in_export]


def _read_value(obj, col):
    if col.export_fn:
        value = col.export_fn(obj)
        return "" if value is None else value
    value = getattr(obj, col.field, None)
    if col.kind == "fk":
        return getattr(value, col.fk_lookup) if value is not None else ""
    if col.kind == "bool":
        return "true" if value else "false"
    return "" if value is None else value


def export_rows(spec):
    cols = [c for c in spec.columns if c.include_in_export]
    return [[_read_value(obj, c) for c in cols] for obj in spec.queryset()]


@dataclass
class ImportResult:
    created: int = 0
    updated: int = 0
    errors: list = field(default_factory=list)


def _row_is_blank(raw: dict) -> bool:
    return not any((v.strip() if isinstance(v, str) else v) for v in raw.values())


def import_rows(spec, dict_rows) -> ImportResult:
    result = ImportResult()
    row_fn = spec.import_row_fn or generic_import_row
    for i, raw in enumerate(dict_rows, start=2):  # row 1 is the header
        if _row_is_blank(raw):
            continue
        try:
            created, _key = row_fn(spec, raw)
            if created:
                result.created += 1
            else:
                result.updated += 1
        except Exception as exc:
            result.errors.append({"row": i, "message": str(exc)})
    return result
