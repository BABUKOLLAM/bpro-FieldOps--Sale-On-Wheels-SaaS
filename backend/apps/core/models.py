import uuid

from django.db import models


class BaseModel(models.Model):
    """
    Common base for all domain models.

    UUID primary keys matter beyond style here: mobile clients generate
    invoice/trip/receipt IDs *offline*, before ever talking to the server,
    and that same ID is the idempotency key used to detect duplicate
    pushes (see apps.mobile_sync) and duplicate ERP postings (see
    apps.integrations.SyncLogEntry). A server-assigned auto-increment ID
    can't do that.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]
