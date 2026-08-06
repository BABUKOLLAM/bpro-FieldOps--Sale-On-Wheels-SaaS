from django.db import models

from apps.core.models import BaseModel


class Godown(BaseModel):
    """A stock location — either a fixed warehouse or a mobile van, per
    agent. Every stock movement in the system (sale, return, load/unload,
    transfer) is expressed as a StockLedgerEntry against a Godown."""

    TYPE_WAREHOUSE = "warehouse"
    TYPE_VAN = "van"
    TYPE_CHOICES = [(TYPE_WAREHOUSE, "Warehouse"), (TYPE_VAN, "Van")]

    name = models.CharField(max_length=100)
    godown_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    assigned_agent = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="godowns"
    )
    is_active = models.BooleanField(default=True)
    tally_godown_guid = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return self.name


class StockLedgerEntry(BaseModel):
    """The single source-of-truth stock ledger. Never edited or deleted
    after creation — corrections are posted as new offsetting entries, the
    same way an accounting ledger works. VanStock is a derived, mutable
    summary kept in sync with this table by apps.inventory.services."""

    TXN_OPENING = "opening"
    TXN_VAN_LOAD = "van_load"
    TXN_VAN_UNLOAD = "van_unload"
    TXN_SALE = "sale"
    TXN_SALE_RETURN = "sale_return"
    TXN_TRANSFER_IN = "transfer_in"
    TXN_TRANSFER_OUT = "transfer_out"
    TXN_ADJUSTMENT = "adjustment"
    TXN_TYPE_CHOICES = [
        (TXN_OPENING, "Opening balance"), (TXN_VAN_LOAD, "Van load"), (TXN_VAN_UNLOAD, "Van unload"),
        (TXN_SALE, "Sale"), (TXN_SALE_RETURN, "Sale return"), (TXN_TRANSFER_IN, "Transfer in"),
        (TXN_TRANSFER_OUT, "Transfer out"), (TXN_ADJUSTMENT, "Adjustment"),
    ]

    godown = models.ForeignKey(Godown, on_delete=models.PROTECT, related_name="ledger_entries")
    item = models.ForeignKey("catalog.Item", on_delete=models.PROTECT, related_name="ledger_entries")
    txn_type = models.CharField(max_length=20, choices=TXN_TYPE_CHOICES)
    qty = models.DecimalField(max_digits=12, decimal_places=3, help_text="Signed: positive = stock in, negative = stock out.")
    balance_after = models.DecimalField(max_digits=12, decimal_places=3)
    reference_type = models.CharField(max_length=50, blank=True, help_text="e.g. 'invoice', 'stock_transfer'")
    reference_id = models.UUIDField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["godown", "item", "created_at"])]

    def __str__(self):
        return f"{self.godown} / {self.item.sku} {self.qty:+} -> {self.balance_after}"


class VanStock(BaseModel):
    """Derived on-hand quantity per (godown, item), maintained transactionally
    alongside StockLedgerEntry writes. Despite the name this covers any
    Godown, not just vans — it's the fast-read counterpart to the ledger."""

    godown = models.ForeignKey(Godown, on_delete=models.CASCADE, related_name="stock")
    item = models.ForeignKey("catalog.Item", on_delete=models.CASCADE, related_name="+")
    qty_on_hand = models.DecimalField(max_digits=12, decimal_places=3, default=0)

    class Meta:
        unique_together = ("godown", "item")

    def __str__(self):
        return f"{self.godown} / {self.item.sku}: {self.qty_on_hand}"


class StockTransfer(BaseModel):
    """Van load (warehouse -> van) / unload (van -> warehouse) / inter-godown
    transfer, with expected-vs-actual variance reporting (FM-09 / FR-07)."""

    TYPE_VAN_LOAD = "van_load"
    TYPE_VAN_UNLOAD = "van_unload"
    TYPE_WAREHOUSE_TRANSFER = "warehouse_transfer"
    TYPE_CHOICES = [
        (TYPE_VAN_LOAD, "Van load"), (TYPE_VAN_UNLOAD, "Van unload"),
        (TYPE_WAREHOUSE_TRANSFER, "Warehouse transfer"),
    ]

    STATUS_DRAFT = "draft"
    STATUS_COMPLETED = "completed"
    STATUS_CHOICES = [(STATUS_DRAFT, "Draft"), (STATUS_COMPLETED, "Completed")]

    transfer_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    from_godown = models.ForeignKey(Godown, on_delete=models.PROTECT, related_name="transfers_out")
    to_godown = models.ForeignKey(Godown, on_delete=models.PROTECT, related_name="transfers_in")
    agent = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    trip = models.ForeignKey("fleet.Trip", null=True, blank=True, on_delete=models.SET_NULL, related_name="stock_transfers")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    transfer_date = models.DateField()
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.get_transfer_type_display()}: {self.from_godown} -> {self.to_godown} ({self.transfer_date})"


class StockTransferLine(BaseModel):
    transfer = models.ForeignKey(StockTransfer, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey("catalog.Item", on_delete=models.PROTECT, related_name="+")
    expected_qty = models.DecimalField(max_digits=12, decimal_places=3)
    actual_qty = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    variance_reason = models.CharField(max_length=255, blank=True)

    @property
    def variance_qty(self):
        if self.actual_qty is None:
            return None
        return self.actual_qty - self.expected_qty

    def __str__(self):
        return f"{self.item.sku}: expected {self.expected_qty}, actual {self.actual_qty}"
