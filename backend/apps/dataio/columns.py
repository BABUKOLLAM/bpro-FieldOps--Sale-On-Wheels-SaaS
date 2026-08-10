from dataclasses import dataclass
from typing import Callable, Optional


@dataclass
class Column:
    """One CSV/xlsx column: a file header mapped to a model field, with
    enough type/FK info to coerce a raw cell value on import and to read
    a display value back out on export.

    `include_in_export` is False for write-only columns that have no
    safe or meaningful read-back (e.g. a password) — they still appear
    in the downloadable template so an operator knows the column exists,
    but are never populated with real data on export. `export_fn`
    overrides the default `getattr(obj, field)` read for columns that
    aren't a plain model attribute (e.g. a user's role, which lives on a
    separate join table)."""

    name: str
    field: str
    required: bool = False
    kind: str = "text"  # text | bool | decimal | int | fk
    fk_model: Optional[type] = None
    fk_lookup: str = "pk"
    fk_create_if_missing: bool = False
    default: object = None
    include_in_export: bool = True
    export_fn: Optional[Callable] = None
