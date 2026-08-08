import uuid

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models


class ChangeRequest(models.Model):
    """
    A pending edit to a governed model (Role permissions today; Master
    Settings models from Phase 3 on), requiring approval before it takes
    effect. Nothing writes to the target model directly once it's governed
    — see apps.governance.services for the registry of what's governed and
    how a change is applied once approved.

    Deliberately lives in the *tenant* database like every other business
    model here (default DATABASE_ROUTERS behavior — apps.tenancy is the
    only app pinned to "default"), so a tenant's Admin/IT Head reviewing
    role changes is an ordinary same-database read, not a cross-tenant
    lookup.
    """

    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=64)
    target = GenericForeignKey("content_type", "object_id")
    # Snapshot of str(target) at proposal time — stays readable even if the
    # target is later renamed/deleted.
    target_label = models.CharField(max_length=255, blank=True)

    proposed_changes = models.JSONField(default=dict)
    previous_snapshot = models.JSONField(default=dict)
    reason = models.CharField(max_length=255, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)

    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="change_requests_made"
    )
    requested_at = models.DateTimeField(auto_now_add=True)

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="change_requests_reviewed",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-requested_at"]

    def __str__(self):
        return f"[{self.status}] {self.target_label} — {self.proposed_changes}"
