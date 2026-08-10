from django.db import models

from apps.core.models import BaseModel


class ImportJob(BaseModel):
    """Audit trail for a master-data bulk import: which entity, who ran
    it, and the per-row outcome — mirrors the traceability already kept
    for other admin actions (apps.governance.ChangeRequest)."""

    entity_slug = models.CharField(max_length=50)
    file_name = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_count = models.PositiveIntegerField(default=0)
    updated_count = models.PositiveIntegerField(default=0)
    error_count = models.PositiveIntegerField(default=0)
    errors = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"{self.entity_slug} import ({self.created_count} created, {self.updated_count} updated, {self.error_count} errors)"
