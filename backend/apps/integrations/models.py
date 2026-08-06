import json

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


def _fernet() -> Fernet:
    key = settings.FIELD_ENCRYPTION_KEY
    if not key:
        raise RuntimeError(
            "FIELD_ENCRYPTION_KEY is not set — required to store ERP connector credentials. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\""
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


class ERPConnection(BaseModel):
    """
    This deployment's single accounting-backend connection (BRD 11.2: "an
    organization runs against exactly one accounting backend at a time").
    In practice there is one active row per deployment/database — matching
    the isolated-deployment-per-client model (see docs/architecture.md).
    """

    ERP_TALLY = "tally"
    ERP_BUSY = "busy"
    ERP_MARG = "marg"
    ERP_MOCK = "mock"
    ERP_TYPE_CHOICES = [
        (ERP_TALLY, "Tally Prime"), (ERP_BUSY, "Busy"), (ERP_MARG, "Marg ERP 9+"), (ERP_MOCK, "Mock (demo/dev)"),
    ]

    SYNC_REALTIME = "realtime"
    SYNC_BATCH = "batch"
    SYNC_MODE_CHOICES = [(SYNC_REALTIME, "Real-time"), (SYNC_BATCH, "Scheduled batch")]

    erp_type = models.CharField(max_length=20, choices=ERP_TYPE_CHOICES, default=ERP_MOCK)
    sync_mode = models.CharField(max_length=20, choices=SYNC_MODE_CHOICES, default=SYNC_BATCH)
    batch_interval_minutes = models.PositiveSmallIntegerField(default=30)
    is_active = models.BooleanField(default=True)
    _credentials_encrypted = models.TextField(blank=True, db_column="credentials_encrypted")

    def __str__(self):
        return f"{self.get_erp_type_display()} ({self.get_sync_mode_display()})"

    @property
    def credentials(self) -> dict:
        if not self._credentials_encrypted:
            return {}
        try:
            return json.loads(_fernet().decrypt(self._credentials_encrypted.encode()).decode())
        except InvalidToken:
            return {}

    @credentials.setter
    def credentials(self, value: dict):
        self._credentials_encrypted = _fernet().encrypt(json.dumps(value).encode()).decode()


class SyncLogEntry(BaseModel):
    """
    The no-duplicate-posting guarantee (BRD 11.4). One row per (entity_type,
    local_object_id) — the unique constraint below is what makes it safe to
    call apps.integrations.tasks.enqueue_tally_job repeatedly for the same
    invoice/receipt/credit_note without ever creating a second "sent" row.
    This row's own id is embedded in the Tally voucher's REFERENCE field
    (see connectors.tally_xml), so even a manual re-import in Tally is
    cross-checkable against this table.
    """

    STATUS_PENDING = "pending"
    STATUS_SENT = "sent"
    STATUS_ACKNOWLEDGED = "acknowledged"
    STATUS_FAILED = "failed"
    STATUS_FAILED_PERMANENT = "failed_permanent"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"), (STATUS_SENT, "Sent"), (STATUS_ACKNOWLEDGED, "Acknowledged"),
        (STATUS_FAILED, "Failed (will retry)"), (STATUS_FAILED_PERMANENT, "Failed (max retries)"),
    ]

    MAX_RETRIES = 6

    entity_type = models.CharField(max_length=30)
    local_object_id = models.UUIDField()
    erp_reference_id = models.CharField(max_length=150, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    retry_count = models.PositiveSmallIntegerField(default=0)
    next_retry_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    request_payload = models.JSONField(default=dict, blank=True)
    response_payload = models.JSONField(default=dict, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["entity_type", "local_object_id"], name="unique_sync_log_per_entity")
        ]
        indexes = [models.Index(fields=["status", "next_retry_at"])]

    def __str__(self):
        return f"{self.entity_type}:{self.local_object_id} [{self.status}]"
