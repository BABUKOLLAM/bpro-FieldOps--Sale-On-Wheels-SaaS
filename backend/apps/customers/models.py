from django.db import models

from apps.core.models import BaseModel


class CustomerCategory(BaseModel):
    name = models.CharField(max_length=100)

    class Meta:
        verbose_name_plural = "customer categories"

    def __str__(self):
        return self.name


class Customer(BaseModel):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    gstin = models.CharField(max_length=15, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    category = models.ForeignKey(
        CustomerCategory, null=True, blank=True, on_delete=models.SET_NULL, related_name="customers"
    )
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    credit_days = models.PositiveSmallIntegerField(default=0)
    outstanding_balance = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text="Authoritative balance. Set from Tally sync where a real ERP is connected; "
                   "maintained locally against sales/receipts otherwise.",
    )
    is_blocked = models.BooleanField(default=False)
    blocked_reason = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    # Populated once this customer/ledger has been synced with Tally (see apps.integrations).
    tally_ledger_guid = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"{self.code} — {self.name}"

    def credit_status(self, additional_amount=0):
        """Used by apps.sales when creating an invoice — see FR-10."""
        if self.is_blocked:
            return "blocked"
        if self.outstanding_balance + additional_amount > self.credit_limit:
            return "over_limit"
        return "ok"


class CustomerAddress(BaseModel):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="addresses")
    label = models.CharField(max_length=50, default="Primary")
    line1 = models.CharField(max_length=255)
    line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100, blank=True)
    pincode = models.CharField(max_length=10, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    def __str__(self):
        return f"{self.customer.name} — {self.label}"


class Beat(BaseModel):
    """A route/journey plan: an ordered list of outlets assigned to an
    agent for a given day/frequency (FR-15 Route / Beat Plan)."""

    name = models.CharField(max_length=100)
    assigned_agent = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="beats"
    )
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class BeatCustomer(BaseModel):
    beat = models.ForeignKey(Beat, on_delete=models.CASCADE, related_name="stops")
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="beat_memberships")
    visit_sequence = models.PositiveSmallIntegerField(default=0)

    class Meta:
        unique_together = ("beat", "customer")
        ordering = ["visit_sequence"]

    def __str__(self):
        return f"{self.beat.name} #{self.visit_sequence}: {self.customer.name}"
