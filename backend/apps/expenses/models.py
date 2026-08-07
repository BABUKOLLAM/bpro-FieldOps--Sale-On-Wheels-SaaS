from django.db import models

from apps.core.models import BaseModel


class Expense(BaseModel):
    """Field expense capture + supervisor approval (FR-06, AR-10).
    Client-generated PK — same idempotency rationale as Invoice/Trip: the
    mobile app creates this offline and it is the key used to dedupe a
    retried push (see apps.mobile_sync)."""

    CATEGORY_FUEL = "fuel"
    CATEGORY_TOLL = "toll"
    CATEGORY_FOOD = "food"
    CATEGORY_MISC = "misc"
    CATEGORY_CHOICES = [
        (CATEGORY_FUEL, "Fuel"), (CATEGORY_TOLL, "Toll"), (CATEGORY_FOOD, "Food"), (CATEGORY_MISC, "Miscellaneous"),
    ]

    STATUS_SUBMITTED = "submitted"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_SUBMITTED, "Submitted"), (STATUS_APPROVED, "Approved"), (STATUS_REJECTED, "Rejected"),
    ]

    agent = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="expenses")
    trip = models.ForeignKey("fleet.Trip", null=True, blank=True, on_delete=models.SET_NULL, related_name="expenses")
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.CharField(max_length=255, blank=True)
    # Uploaded post-sync via a follow-up multipart PATCH, same pattern as
    # Invoice.signature_image — never trusted/required at push time since
    # the mobile app is offline when the expense is first created.
    receipt_photo = models.ImageField(upload_to="expense_receipts/", null=True, blank=True)
    expense_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_SUBMITTED)
    approved_by = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.CharField(max_length=255, blank=True)
    device_created_at = models.DateTimeField(
        null=True, blank=True, help_text="When the expense was actually captured on-device, for offline records."
    )

    def __str__(self):
        return f"{self.get_category_display()} ₹{self.amount} — {self.agent}"
