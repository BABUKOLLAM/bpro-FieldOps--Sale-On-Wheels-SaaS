"""§18 UPI QR at point of sale: a static `upi://pay` deep link — no
payment gateway account required, any UPI app can scan and pay it
directly. The payee VPA lives on Company.upi_vpa (governed via
apps.governance, see apps.company.governance); blank means QR generation
is unavailable for this deployment until an operator configures one."""

import io
from urllib.parse import urlencode

import qrcode

from .models import Invoice


def build_upi_uri(invoice: Invoice) -> str | None:
    company = invoice.gst_registration.company
    vpa = (company.upi_vpa or "").strip()
    if not vpa:
        return None
    payee_name = company.display_name or company.legal_name
    params = {
        "pa": vpa,
        "pn": payee_name,
        "am": f"{invoice.grand_total:.2f}",
        "cu": "INR",
        "tn": f"Invoice {invoice.invoice_no or invoice.id}",
    }
    return "upi://pay?" + urlencode(params)


def build_upi_qr_png(uri: str) -> bytes:
    """Renders the given upi:// URI as a QR code PNG, for embedding into
    the printable invoice PDF (see invoice_pdf.py)."""
    image = qrcode.make(uri)
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()
