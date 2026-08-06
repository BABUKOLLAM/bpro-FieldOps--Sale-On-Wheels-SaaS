from django.db import models

from apps.core.models import BaseModel


class PushRequestLog(BaseModel):
    """
    Idempotency guard for the mobile push endpoint (WatermelonDB
    synchronize() protocol — see docs/architecture.md). `idempotency_key`
    is the client-generated UUID of the record being pushed (an
    Invoice.id, Trip.id, etc.) — the same value that also becomes that
    record's primary key. A retried push (flaky connectivity mid-request)
    hits this unique constraint and is treated as already-applied rather
    than creating a duplicate.
    """

    STATUS_APPLIED = "applied"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [(STATUS_APPLIED, "Applied"), (STATUS_REJECTED, "Rejected")]

    device = models.ForeignKey("accounts.Device", on_delete=models.CASCADE, related_name="push_logs")
    entity_type = models.CharField(max_length=30)
    idempotency_key = models.UUIDField(unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_APPLIED)
    error_message = models.TextField(blank=True)

    def __str__(self):
        return f"{self.entity_type}:{self.idempotency_key} [{self.status}]"
