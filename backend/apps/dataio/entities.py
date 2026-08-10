from decimal import Decimal

from apps.accounts.constants import (
    PERM_CATALOG_MANAGE,
    PERM_CUSTOMERS_MANAGE,
    PERM_FLEET_VEHICLE_MANAGE,
    PERM_INVENTORY_MANAGE,
    PERM_USERS_MANAGE,
)
from apps.accounts.models import User
from apps.catalog.models import Item, ItemCategory, PriceList, PriceListItem, UOM
from apps.customers.models import Beat, Customer, CustomerCategory
from apps.fleet.models import Vehicle
from apps.inventory.models import Godown

from .columns import Column
from .entity_spec import EntitySpec
from .row_importers import import_price_row, import_staff_row

REGISTRY: dict[str, EntitySpec] = {}


def _register(spec: EntitySpec) -> None:
    REGISTRY[spec.slug] = spec


_register(EntitySpec(
    slug="products",
    label="Products",
    model=Item,
    permission_code=PERM_CATALOG_MANAGE,
    queryset=lambda: Item.objects.select_related("category", "base_uom").order_by("sku"),
    key_columns=["sku"],
    columns=[
        Column("sku", "sku", required=True),
        Column("name", "name", required=True),
        Column("category", "category", kind="fk", fk_model=ItemCategory, fk_lookup="name", fk_create_if_missing=True),
        Column("base_uom", "base_uom", required=True, kind="fk", fk_model=UOM, fk_lookup="code"),
        Column("hsn_code", "hsn_code", default=""),
        Column("gst_rate", "gst_rate", kind="decimal", default=Decimal("0")),
        Column("barcode", "barcode", default=""),
        Column("is_active", "is_active", kind="bool", default=True),
    ],
))

_register(EntitySpec(
    slug="prices",
    label="Price List Entries",
    model=PriceListItem,
    permission_code=PERM_CATALOG_MANAGE,
    queryset=lambda: PriceListItem.objects.select_related("price_list", "item").order_by(
        "price_list__name", "item__sku"
    ),
    key_columns=["price_list", "item"],
    columns=[
        Column("price_list", "price_list", required=True, kind="fk", fk_model=PriceList, fk_lookup="name"),
        Column("sku", "item", required=True, kind="fk", fk_model=Item, fk_lookup="sku"),
        Column("rate", "rate", required=True, kind="decimal"),
    ],
    import_row_fn=import_price_row,
))

_register(EntitySpec(
    slug="staff",
    label="Staff / Employees",
    model=User,
    permission_code=PERM_USERS_MANAGE,
    queryset=lambda: User.objects.order_by("username"),
    key_columns=["username"],
    columns=[
        Column("username", "username", required=True),
        Column("first_name", "first_name", default=""),
        Column("last_name", "last_name", default=""),
        Column("email", "email", default=""),
        Column("phone", "phone", default=""),
        Column("employee_code", "employee_code"),  # null=True on the model — blank stays None, not ""
        Column("is_field_agent", "is_field_agent", kind="bool", default=False),
        Column("reporting_manager", "reporting_manager", kind="fk", fk_model=User, fk_lookup="username"),
        Column("is_active", "is_active", kind="bool", default=True),
        Column(
            "role", "role",
            export_fn=lambda u: ", ".join(u.user_roles.values_list("role__name", flat=True)),
        ),
        Column("password", "password", include_in_export=False),
    ],
    import_row_fn=import_staff_row,
))

_register(EntitySpec(
    slug="routes",
    label="Routes / Beats",
    model=Beat,
    permission_code=PERM_CUSTOMERS_MANAGE,
    queryset=lambda: Beat.objects.select_related("assigned_agent").order_by("name"),
    key_columns=["name"],
    columns=[
        Column("name", "name", required=True),
        Column("assigned_agent", "assigned_agent", kind="fk", fk_model=User, fk_lookup="username"),
        Column("is_active", "is_active", kind="bool", default=True),
    ],
))

_register(EntitySpec(
    slug="customers",
    label="Customers",
    model=Customer,
    permission_code=PERM_CUSTOMERS_MANAGE,
    queryset=lambda: Customer.objects.select_related("category").order_by("code"),
    key_columns=["code"],
    columns=[
        Column("code", "code", required=True),
        Column("name", "name", required=True),
        Column("category", "category", kind="fk", fk_model=CustomerCategory, fk_lookup="name", fk_create_if_missing=True),
        Column("gstin", "gstin", default=""),
        Column("phone", "phone", default=""),
        Column("credit_limit", "credit_limit", kind="decimal", default=Decimal("0")),
        Column("credit_days", "credit_days", kind="int", default=0),
        Column("is_blocked", "is_blocked", kind="bool", default=False),
        Column("is_active", "is_active", kind="bool", default=True),
    ],
))

_register(EntitySpec(
    slug="vehicles",
    label="Vehicles",
    model=Vehicle,
    permission_code=PERM_FLEET_VEHICLE_MANAGE,
    queryset=lambda: Vehicle.objects.select_related("assigned_agent").order_by("reg_no"),
    key_columns=["reg_no"],
    columns=[
        Column("reg_no", "reg_no", required=True),
        Column("vehicle_type", "vehicle_type", default=""),
        Column("fuel_type", "fuel_type", default="diesel"),
        Column("assigned_agent", "assigned_agent", kind="fk", fk_model=User, fk_lookup="username"),
        Column("is_active", "is_active", kind="bool", default=True),
    ],
))

_register(EntitySpec(
    slug="godowns",
    label="Godowns",
    model=Godown,
    permission_code=PERM_INVENTORY_MANAGE,
    queryset=lambda: Godown.objects.select_related("assigned_agent").order_by("name"),
    key_columns=["name"],
    columns=[
        Column("name", "name", required=True),
        Column("godown_type", "godown_type", required=True),
        Column("assigned_agent", "assigned_agent", kind="fk", fk_model=User, fk_lookup="username"),
        Column("is_active", "is_active", kind="bool", default=True),
    ],
))
