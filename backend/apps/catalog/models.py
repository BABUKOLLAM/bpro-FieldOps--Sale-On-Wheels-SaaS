from django.db import models

from apps.core.models import BaseModel


class UOM(BaseModel):
    """Unit of measure, e.g. PCS, BOX, KG."""

    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=50)

    def __str__(self):
        return self.code


class ItemCategory(BaseModel):
    name = models.CharField(max_length=100)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="children")

    class Meta:
        verbose_name_plural = "item categories"

    def __str__(self):
        return self.name


class Item(BaseModel):
    sku = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    barcode = models.CharField(max_length=100, blank=True, db_index=True)
    category = models.ForeignKey(ItemCategory, null=True, blank=True, on_delete=models.SET_NULL, related_name="items")
    base_uom = models.ForeignKey(UOM, on_delete=models.PROTECT, related_name="+")
    hsn_code = models.CharField(max_length=20, blank=True)
    gst_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=0, help_text="Combined GST rate, e.g. 18.00 for 18%."
    )
    is_active = models.BooleanField(default=True)
    # Populated once this item has been synced to/from Tally (see apps.integrations).
    tally_guid = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"{self.sku} — {self.name}"


class PriceList(BaseModel):
    name = models.CharField(max_length=100)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class PriceListItem(BaseModel):
    price_list = models.ForeignKey(PriceList, on_delete=models.CASCADE, related_name="items")
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="price_list_entries")
    rate = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        unique_together = ("price_list", "item")

    def __str__(self):
        return f"{self.item.sku} @ {self.rate} ({self.price_list.name})"


class Scheme(BaseModel):
    """Scheme engine (FR-14): a discount rule scoped to either a single
    item or a whole category, valid for a date range. Two shapes:
    flat/percent (a fixed discount regardless of quantity) or slab — a
    volume/quantity-tiered discount defined by this scheme's `slabs`
    (e.g. 10-49 units -> 5% off, 50+ units -> 10% off). `value` is unused
    when `discount_type=slab`; the slabs carry their own value instead.

    BXGY ("buy X get Y") is a materially different mechanic — it adds a
    free/discounted bonus line to the invoice rather than discounting an
    existing line — and is intentionally not covered by this table. It's
    the natural next extension once needed."""

    DISCOUNT_FLAT = "flat"
    DISCOUNT_PERCENT = "percent"
    DISCOUNT_SLAB = "slab"
    DISCOUNT_TYPE_CHOICES = [
        (DISCOUNT_FLAT, "Flat amount off"), (DISCOUNT_PERCENT, "Percent off"), (DISCOUNT_SLAB, "Volume/slab discount"),
    ]

    name = models.CharField(max_length=100)
    item = models.ForeignKey(Item, null=True, blank=True, on_delete=models.CASCADE, related_name="schemes")
    category = models.ForeignKey(ItemCategory, null=True, blank=True, on_delete=models.CASCADE, related_name="schemes")
    discount_type = models.CharField(max_length=10, choices=DISCOUNT_TYPE_CHOICES)
    value = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Discount amount/percent for flat or percent schemes. Unused for slab schemes — see slabs.",
    )
    valid_from = models.DateField()
    valid_to = models.DateField()
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

    def applies_to(self, item: Item) -> bool:
        if self.item_id:
            return self.item_id == item.id
        if self.category_id:
            return item.category_id == self.category_id
        return False


class SchemeSlab(BaseModel):
    """One quantity tier of a `discount_type=slab` Scheme. `max_qty` null
    means "and above" — the open-ended top tier."""

    scheme = models.ForeignKey(Scheme, on_delete=models.CASCADE, related_name="slabs")
    min_qty = models.DecimalField(max_digits=12, decimal_places=3)
    max_qty = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    discount_type = models.CharField(
        max_length=10, choices=[(Scheme.DISCOUNT_FLAT, "Flat amount off"), (Scheme.DISCOUNT_PERCENT, "Percent off")],
    )
    value = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        ordering = ["min_qty"]

    def __str__(self):
        upper = self.max_qty if self.max_qty is not None else "+"
        return f"{self.scheme.name}: {self.min_qty}-{upper}"

    def matches(self, qty) -> bool:
        if qty < self.min_qty:
            return False
        return self.max_qty is None or qty <= self.max_qty
