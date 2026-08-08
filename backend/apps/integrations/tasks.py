import logging
from datetime import timedelta

from celery import shared_task
from django.db import IntegrityError, transaction
from django.utils import timezone

from .connectors.base import ConnectorError
from .connectors.local_json_api import BusyConnector, MargConnector
from .connectors.mock import MockConnector
from .connectors.tally_xml import TallyXMLConnector
from .models import ERPConnection, SyncLogEntry

logger = logging.getLogger(__name__)

# 1m, 5m, 15m, 1h, then hourly to a 24h cap (BRD 11.4 Failure Recovery).
RETRY_BACKOFF_MINUTES = [1, 5, 15, 60, 60, 60]

_CONNECTOR_CLASSES = {
    ERPConnection.ERP_MOCK: MockConnector,
    ERPConnection.ERP_TALLY: TallyXMLConnector,
    ERPConnection.ERP_BUSY: BusyConnector,
    ERPConnection.ERP_MARG: MargConnector,
}


def _active_connection() -> ERPConnection:
    connection = ERPConnection.objects.filter(is_active=True).first()
    if connection is None:
        connection = ERPConnection.objects.create(erp_type=ERPConnection.ERP_MOCK)
    return connection


def _build_payload(entity_type: str, obj) -> dict:
    if entity_type == "invoice":
        return {
            "id": str(obj.id),
            "date": obj.invoice_date.isoformat(),
            "party_ledger": obj.customer.tally_ledger_guid or obj.customer.name,
            "amount": str(obj.grand_total),
            "lines": [
                {"item_sku": line.item.sku, "qty": str(line.qty), "amount": str(line.line_total)}
                for line in obj.lines.select_related("item").all()
            ],
        }
    if entity_type == "receipt":
        return {
            "id": str(obj.id),
            "date": obj.received_at.date().isoformat(),
            "party_ledger": obj.customer.tally_ledger_guid or obj.customer.name,
            "amount": str(obj.amount),
            "lines": [],
        }
    if entity_type == "credit_note":
        return {
            "id": str(obj.id),
            "date": obj.note_date.isoformat(),
            "party_ledger": obj.customer.tally_ledger_guid or obj.customer.name,
            "amount": str(obj.grand_total),
            "lines": [
                {"item_sku": line.item.sku, "qty": str(line.qty), "amount": str(line.line_total)}
                for line in obj.lines.select_related("item").all()
            ],
        }
    raise ValueError(f"Unknown entity_type for sync payload: {entity_type!r}")


def _load_entity(entity_type: str, object_id):
    from apps.sales.models import CreditNote, Invoice, Receipt

    model = {"invoice": Invoice, "receipt": Receipt, "credit_note": CreditNote}[entity_type]
    return model.objects.get(pk=object_id)


@shared_task
def enqueue_tally_job(entity_type: str, local_object_id):
    """
    Called from apps.sales.services on invoice/receipt/credit_note
    finalization. get_or_create on the (entity_type, local_object_id)
    unique constraint means calling this twice for the same record is a
    no-op the second time — the core duplicate-posting guard.
    """
    try:
        with transaction.atomic():
            entry, created = SyncLogEntry.objects.get_or_create(
                entity_type=entity_type, local_object_id=local_object_id,
                defaults={"status": SyncLogEntry.STATUS_PENDING},
            )
    except IntegrityError:
        entry = SyncLogEntry.objects.get(entity_type=entity_type, local_object_id=local_object_id)
        created = False

    if not created:
        return str(entry.id)

    connection = _active_connection()
    if connection.sync_mode == ERPConnection.SYNC_REALTIME or connection.erp_type == ERPConnection.ERP_MOCK:
        # Real-time mode, or the mock connector (which has nothing external
        # to poll) — process immediately via Celery rather than waiting for
        # an on-prem connector agent that doesn't exist for a demo tenant.
        process_sync_job.delay(str(entry.id))
    # Batch mode against a real ERP: the row stays "pending" and is picked
    # up by the on-prem connector agent's poll (see apps.integrations.views
    # ConnectorJobViewSet) on its configured interval.
    return str(entry.id)


@shared_task
def process_sync_job(sync_log_id):
    try:
        entry = SyncLogEntry.objects.get(pk=sync_log_id)
    except SyncLogEntry.DoesNotExist:
        logger.warning("process_sync_job: SyncLogEntry %s no longer exists", sync_log_id)
        return

    if entry.status in (SyncLogEntry.STATUS_ACKNOWLEDGED, SyncLogEntry.STATUS_SENT):
        return

    connection = _active_connection()
    connector_cls = _CONNECTOR_CLASSES.get(connection.erp_type)
    if connector_cls is None:
        entry.status = SyncLogEntry.STATUS_FAILED_PERMANENT
        entry.error_message = f"No connector implemented for erp_type={connection.erp_type!r}"
        entry.save(update_fields=["status", "error_message"])
        return

    try:
        obj = _load_entity(entry.entity_type, entry.local_object_id)
        payload = _build_payload(entry.entity_type, obj)
        entry.request_payload = payload
        connector = connector_cls(connection.credentials)
        erp_reference_id = connector.push_voucher(entry.entity_type, payload)
    except ConnectorError as exc:
        _mark_failed(entry, str(exc))
        return
    except Exception as exc:  # noqa: BLE001 — surfaced verbatim to the Sync Monitor
        _mark_failed(entry, f"Unexpected error: {exc}")
        return

    entry.status = SyncLogEntry.STATUS_ACKNOWLEDGED
    entry.erp_reference_id = erp_reference_id
    entry.error_message = ""
    entry.save(update_fields=["status", "erp_reference_id", "error_message", "request_payload"])

    if entry.entity_type in ("invoice", "receipt", "credit_note"):
        obj = _load_entity(entry.entity_type, entry.local_object_id)
        obj.sync_status = "synced"
        obj.save(update_fields=["sync_status"])


def _mark_failed(entry: SyncLogEntry, message: str):
    entry.retry_count += 1
    entry.error_message = message
    if entry.retry_count >= SyncLogEntry.MAX_RETRIES:
        entry.status = SyncLogEntry.STATUS_FAILED_PERMANENT
        entry.next_retry_at = None
    else:
        entry.status = SyncLogEntry.STATUS_FAILED
        backoff = RETRY_BACKOFF_MINUTES[min(entry.retry_count - 1, len(RETRY_BACKOFF_MINUTES) - 1)]
        entry.next_retry_at = timezone.now() + timedelta(minutes=backoff)
    entry.save(update_fields=["retry_count", "error_message", "status", "next_retry_at"])

    if entry.entity_type in ("invoice", "receipt", "credit_note"):
        obj = _load_entity(entry.entity_type, entry.local_object_id)
        obj.sync_status = "failed"
        obj.save(update_fields=["sync_status"])


@shared_task
def requeue_stale_pending_jobs():
    """Celery Beat sweep (every 5 min, see config.settings.base
    CELERY_BEAT_SCHEDULE): reconciles anything stuck — a failed job whose
    backoff has elapsed, or a pending job that a Redis hiccup dropped
    before it reached process_sync_job."""
    due = SyncLogEntry.objects.filter(
        status=SyncLogEntry.STATUS_FAILED, next_retry_at__lte=timezone.now(),
    )
    count = 0
    for entry in due:
        process_sync_job.delay(str(entry.id))
        count += 1
    return count


@shared_task
def retry_sync_job(sync_log_id):
    """Manual "Retry now" from the Sync Monitor (AR-09)."""
    entry = SyncLogEntry.objects.get(pk=sync_log_id)
    entry.status = SyncLogEntry.STATUS_PENDING
    entry.save(update_fields=["status"])
    process_sync_job.delay(str(entry.id))
