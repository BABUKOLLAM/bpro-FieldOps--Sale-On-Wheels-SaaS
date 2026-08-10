"""GST e-way bill generation. Builds a representative subset of the NIC
e-way-bill-portal request schema (the real spec has ~40 fields; this
covers the fields every filing needs — party/GSTIN, document, item/tax
summary, and transport details) plus a printable PDF, so the payload can
be manually filed on the government portal or handed to a GSP
(GST Suvidha Provider) bulk-upload tool.

There is no live NIC/GSP API connection here — that needs a client's own
registered API credentials, which this deployment doesn't have (same
category as needing a real OTP/SMS/FCM/payment-gateway account, handled
the same way elsewhere in this codebase: build the real, complete local
piece, leave the actual vendor call unconnected). See EwayBill's
docstring for why `ewb_number` deliberately stays blank."""

import io
from datetime import timedelta

from django.http import HttpResponse
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .invoice_pdf import _buyer_block, _money, _seller_block
from .models import EwayBill, EwayBillSettings, Invoice

_STYLES = getSampleStyleSheet()
_TITLE_STYLE = ParagraphStyle("EwbTitle", parent=_STYLES["Title"], alignment=2, fontSize=15)
_HEADING_STYLE = ParagraphStyle("EwbHeading", parent=_STYLES["Normal"], fontSize=8, textColor=colors.grey)
_BODY_STYLE = _STYLES["Normal"]
_SMALL_STYLE = ParagraphStyle("EwbSmall", parent=_STYLES["Normal"], fontSize=8)
_WARNING_STYLE = ParagraphStyle(
    "EwbWarning", parent=_STYLES["Normal"], fontSize=9, textColor=colors.HexColor("#b91c1c"),
)

_TRANSPORT_MODE_CODE = {
    EwayBill.MODE_ROAD: "1", EwayBill.MODE_RAIL: "2", EwayBill.MODE_AIR: "3", EwayBill.MODE_SHIP: "4",
}

# NIC rule of thumb: one additional day of validity per 200km travelled
# (regular vehicle), minimum one day. A representative approximation —
# the real portal computes this server-side from the actual distance
# entered at filing time.
_VALIDITY_KM_PER_DAY = 200


def eway_bill_required(invoice: Invoice) -> bool:
    settings_obj = EwayBillSettings.get_solo()
    return settings_obj.is_active and invoice.grand_total >= settings_obj.threshold_amount


def build_eway_bill_payload(invoice: Invoice, *, transport_mode, vehicle_no, transporter_id, transporter_name, distance_km):
    gst_registration = invoice.gst_registration
    company = gst_registration.company
    customer = invoice.customer
    address = customer.addresses.first()
    lines = list(invoice.lines.select_related("item").all())
    is_interstate = any(line.igst_amount for line in lines)

    item_list = [
        {
            "hsnCode": line.item.hsn_code,
            "productName": line.item.name,
            "qty": float(line.qty),
            "qtyUnit": line.item.base_uom.code,
            "taxableAmount": float(line.taxable_amount),
            "cgstAmount": float(line.cgst_amount),
            "sgstAmount": float(line.sgst_amount),
            "igstAmount": float(line.igst_amount),
        }
        for line in lines
    ]

    return {
        "supplyType": "O",
        "subSupplyType": "1",
        "docType": "INV",
        "docNo": invoice.invoice_no or str(invoice.id),
        "docDate": invoice.invoice_date.strftime("%d/%m/%Y"),
        "fromGstin": gst_registration.gstin,
        "fromTrdName": company.display_name or company.legal_name,
        "fromAddr1": gst_registration.address_line1,
        "fromAddr2": gst_registration.address_line2,
        "fromPlace": gst_registration.city,
        "fromPincode": gst_registration.pincode,
        "fromStateCode": gst_registration.state,
        "toGstin": customer.gstin or "URP",
        "toTrdName": customer.name,
        "toAddr1": address.line1 if address else "",
        "toAddr2": address.line2 if address else "",
        "toPlace": address.city if address else "",
        "toPincode": address.pincode if address else "",
        "toStateCode": invoice.place_of_supply_state,
        "transactionType": 3 if is_interstate else 1,
        "totalValue": float(invoice.subtotal - invoice.discount_total),
        "cgstValue": float(sum(line.cgst_amount for line in lines)),
        "sgstValue": float(sum(line.sgst_amount for line in lines)),
        "igstValue": float(sum(line.igst_amount for line in lines)),
        "totInvValue": float(invoice.grand_total),
        "transMode": _TRANSPORT_MODE_CODE.get(transport_mode, "1"),
        "transDistance": str(distance_km),
        "transporterId": transporter_id,
        "transporterName": transporter_name,
        "vehicleNo": vehicle_no,
        "vehicleType": "R",
        "itemList": item_list,
    }


def generate_eway_bill(invoice: Invoice, *, transport_mode, vehicle_no, transporter_id="", transporter_name="", distance_km=0) -> EwayBill:
    payload = build_eway_bill_payload(
        invoice,
        transport_mode=transport_mode, vehicle_no=vehicle_no,
        transporter_id=transporter_id, transporter_name=transporter_name, distance_km=distance_km,
    )
    validity_days = max(1, -(-max(distance_km, 1) // _VALIDITY_KM_PER_DAY))  # ceil division, min 1 day
    now = timezone.now()
    ewb, _created = EwayBill.objects.update_or_create(
        invoice=invoice,
        defaults={
            "status": EwayBill.STATUS_DRAFT,
            "transport_mode": transport_mode,
            "vehicle_no": vehicle_no,
            "transporter_id": transporter_id,
            "transporter_name": transporter_name,
            "distance_km": distance_km,
            "payload": payload,
            "valid_until": now + timedelta(days=validity_days),
        },
    )
    return ewb


def _party_table(invoice: Invoice, ewb: EwayBill) -> Table:
    left = [Paragraph("<b>From</b>", _HEADING_STYLE), *_seller_block(invoice)]
    right = [Paragraph("<b>To</b>", _HEADING_STYLE), *_buyer_block(invoice)]
    table = Table([[left, right]], colWidths=[240, 240])
    table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    return table


def _transport_table(ewb: EwayBill) -> Table:
    rows = [
        ["Transport mode", ewb.get_transport_mode_display()],
        ["Vehicle no.", ewb.vehicle_no or "—"],
        ["Transporter", ewb.transporter_name or "—"],
        ["Transporter GSTIN", ewb.transporter_id or "—"],
        ["Distance (km)", str(ewb.distance_km)],
        ["Valid until", ewb.valid_until.strftime("%d-%b-%Y %H:%M") if ewb.valid_until else "—"],
    ]
    table = Table(rows, colWidths=[140, 340])
    table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return table


def _item_summary_table(payload: dict) -> Table:
    headers = ["HSN", "Item", "Qty", "Taxable", "CGST", "SGST", "IGST"]
    rows = [headers]
    for item in payload.get("itemList", []):
        rows.append([
            item["hsnCode"] or "—",
            item["productName"],
            f"{item['qty']:g} {item['qtyUnit']}".strip(),
            _money(item["taxableAmount"]),
            _money(item["cgstAmount"]),
            _money(item["sgstAmount"]),
            _money(item["igstAmount"]),
        ])
    table = Table(rows, colWidths=[45, 165, 60, 55, 45, 45, 45], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))
    return table


def build_eway_bill_pdf_bytes(ewb: EwayBill) -> bytes:
    invoice = ewb.invoice
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm, bottomMargin=18 * mm, leftMargin=18 * mm, rightMargin=18 * mm)
    elements = [
        Paragraph("E-WAY BILL — DRAFT", _TITLE_STYLE),
        Paragraph(
            "This is a locally-generated draft, not a government-issued e-way bill. "
            "File this payload on the GST e-way-bill portal (or via your GSP) to obtain "
            "a valid EWB number before the goods are transported.",
            _WARNING_STYLE,
        ),
        Spacer(1, 6 * mm),
        Paragraph(f"<b>Reference invoice:</b> {invoice.invoice_no or invoice.id}", _SMALL_STYLE),
        Paragraph(f"<b>Invoice date:</b> {invoice.invoice_date.strftime('%d-%b-%Y')}", _SMALL_STYLE),
        Spacer(1, 6 * mm),
        _party_table(invoice, ewb),
        Spacer(1, 6 * mm),
        Paragraph("<b>Transport details</b>", _HEADING_STYLE),
        _transport_table(ewb),
        Spacer(1, 6 * mm),
        Paragraph("<b>Item / tax summary</b>", _HEADING_STYLE),
        _item_summary_table(ewb.payload),
    ]
    doc.build(elements)
    return buf.getvalue()


def eway_bill_pdf_response(ewb: EwayBill) -> HttpResponse:
    content = build_eway_bill_pdf_bytes(ewb)
    response = HttpResponse(content, content_type="application/pdf")
    filename = f"eway-bill-draft-{ewb.invoice.invoice_no or ewb.invoice_id}.pdf"
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response
