from dataclasses import dataclass
from typing import Callable, Optional


@dataclass
class EntitySpec:
    """One importable/exportable master-data entity, e.g. "products" ->
    apps.catalog.Item. `import_row_fn` defaults to the generic single-key
    upsert (see row_importers.generic_import_row); entities whose import
    needs bespoke handling (price list entries, staff) supply their own."""

    slug: str
    label: str
    model: type
    permission_code: str
    queryset: Callable
    columns: list
    key_columns: list
    import_row_fn: Optional[Callable] = None
