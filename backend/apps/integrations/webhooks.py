"""
Generic multi-ERP / third-party integration layer (BRD 11.3) — dispatch
side. See apps.integrations.models.Webhook for the subscription model.
Stdlib-only (urllib, hmac), same convention as the connectors package.
"""
import hashlib
import hmac
import json
import urllib.error
import urllib.request

from .models import Webhook, WebhookDeliveryLog


def _sign(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def _invoice_payload(invoice) -> dict:
    return {
        "invoice_id": str(invoice.id),
        "invoice_no": invoice.invoice_no,
        "customer_id": str(invoice.customer_id),
        "customer_name": invoice.customer.name,
        "agent_id": str(invoice.agent_id),
        "invoice_date": invoice.invoice_date.isoformat(),
        "subtotal": str(invoice.subtotal),
        "discount_total": str(invoice.discount_total),
        "tax_total": str(invoice.tax_total),
        "grand_total": str(invoice.grand_total),
        "payment_status": invoice.payment_status,
        "lines": [
            {
                "item_sku": line.item.sku, "item_name": line.item.name,
                "qty": str(line.qty), "rate": str(line.rate), "line_total": str(line.line_total),
            }
            for line in invoice.lines.select_related("item").all()
        ],
    }


def _receipt_payload(receipt) -> dict:
    return {
        "receipt_id": str(receipt.id),
        "receipt_no": receipt.receipt_no,
        "customer_id": str(receipt.customer_id),
        "customer_name": receipt.customer.name,
        "agent_id": str(receipt.agent_id),
        "mode": receipt.mode,
        "amount": str(receipt.amount),
        "received_at": receipt.received_at.isoformat(),
    }


def _credit_note_payload(credit_note) -> dict:
    return {
        "credit_note_id": str(credit_note.id),
        "credit_note_no": credit_note.credit_note_no,
        "customer_id": str(credit_note.customer_id),
        "customer_name": credit_note.customer.name,
        "original_invoice_id": str(credit_note.original_invoice_id),
        "grand_total": str(credit_note.grand_total),
        "note_date": credit_note.note_date.isoformat(),
        "lines": [
            {"item_sku": line.item.sku, "qty": str(line.qty), "condition": line.condition, "line_total": str(line.line_total)}
            for line in credit_note.lines.select_related("item").all()
        ],
    }


_PAYLOAD_BUILDERS = {
    Webhook.EVENT_INVOICE_FINALIZED: _invoice_payload,
    Webhook.EVENT_RECEIPT_FINALIZED: _receipt_payload,
    Webhook.EVENT_CREDIT_NOTE_FINALIZED: _credit_note_payload,
}


def dispatch_event(event_type: str, obj) -> None:
    """Fires `event_type` to every active Webhook subscribed to it. Never
    raises — a subscriber being down/misconfigured must not break the
    invoice/receipt/credit-note finalization it's attached to via
    transaction.on_commit (see apps.sales.services)."""
    builder = _PAYLOAD_BUILDERS.get(event_type)
    if builder is None:
        return
    subscribers = Webhook.objects.filter(is_active=True, event_types__contains=[event_type])
    if not subscribers:
        return

    payload = {"event": event_type, "data": builder(obj)}
    body = json.dumps(payload).encode("utf-8")

    for webhook in subscribers:
        signature = _sign(webhook.secret, body)
        request = urllib.request.Request(
            webhook.url, data=body, method="POST",
            headers={
                "Content-Type": "application/json",
                "X-Webhook-Event": event_type,
                "X-Webhook-Signature": f"sha256={signature}",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                WebhookDeliveryLog.objects.create(
                    webhook=webhook, event_type=event_type, payload=payload,
                    status=WebhookDeliveryLog.STATUS_SUCCESS, response_status_code=response.status,
                )
        except (urllib.error.URLError, TimeoutError) as exc:
            WebhookDeliveryLog.objects.create(
                webhook=webhook, event_type=event_type, payload=payload,
                status=WebhookDeliveryLog.STATUS_FAILED, error_message=str(exc),
            )
