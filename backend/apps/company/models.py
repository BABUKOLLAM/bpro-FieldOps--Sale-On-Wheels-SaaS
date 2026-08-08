from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import BaseModel

from .constants import INDIAN_STATES


class Company(BaseModel):
    """
    Represents the one distributor/FMCG company running on this deployment.

    This is intentionally a singleton — this codebase is deployed once per
    client (see docs/PROVISIONING.md), so there is exactly one Company row
    per database. It is not a multi-tenant "tenant" table.
    """

    legal_name = models.CharField(max_length=255)
    display_name = models.CharField(max_length=255, blank=True)
    fy_start_month = models.PositiveSmallIntegerField(
        default=4, help_text="1=January .. 12=December. Indian FY default is April."
    )
    default_godown = models.ForeignKey(
        "inventory.Godown", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    is_active = models.BooleanField(default=True)
    logo = models.ImageField(
        upload_to="branding/", null=True, blank=True,
        help_text="Shown on the GST invoice PDF header. Uploaded directly (not via Master Settings "
        "approval, same as default_godown) — binary data doesn't fit a ChangeRequest's JSON diff.",
    )

    class Meta:
        verbose_name_plural = "companies"

    def __str__(self):
        return self.display_name or self.legal_name

    def clean(self):
        if Company.objects.exclude(pk=self.pk).exists():
            raise ValidationError("Only one Company record is permitted per deployment.")


class GSTRegistration(BaseModel):
    """One GSTIN per state the company operates in (BRD 20.7: multi-state
    GST handling is a foundational requirement, not a later add-on)."""

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="gst_registrations")
    state = models.CharField(max_length=2, choices=INDIAN_STATES)
    gstin = models.CharField(max_length=15, unique=True)
    address_line1 = models.CharField(max_length=255)
    address_line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100)
    pincode = models.CharField(max_length=10)
    is_default = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["company"],
                condition=models.Q(is_default=True),
                name="unique_default_gst_registration_per_company",
            )
        ]

    def __str__(self):
        return f"{self.gstin} ({self.get_state_display()})"
