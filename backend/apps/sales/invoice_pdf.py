"""FR-01/BRD 20.7: a real GST-formatted tax invoice PDF, distinct from
apps.reporting.exports' generic headers+rows tabular report. Reads
already-computed values off Invoice/InvoiceLine (CGST/SGST/IGST split,
totals) — apps.sales.services owns that calculation, this module only
lays it out."""

import io

from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .models import Invoice
from .upi_qr import build_upi_qr_png, build_upi_uri

_STYLES = getSampleStyleSheet()
_TITLE_STYLE = ParagraphStyle("InvoiceTitle", parent=_STYLES["Title"], alignment=2, fontSize=16)
_HEADING_STYLE = ParagraphStyle("SectionHeading", parent=_STYLES["Normal"], fontSize=8, textColor=colors.grey)
_BODY_STYLE = _STYLES["Normal"]
_SMALL_STYLE = ParagraphStyle("Small", parent=_STYLES["Normal"], fontSize=8)


def _money(value) -> str:
    return f"Rs. {value:,.2f}"


def _seller_block(invoice: Invoice) -> list:
    gst_registration = invoice.gst_registration
    company = gst_registration.company
    lines = [
        f"<b>{company.display_name or company.legal_name}</b>",
        gst_registration.address_line1,
    ]
    if gst_registration.address_line2:
        lines.append(gst_registration.address_line2)
    lines.append(f"{gst_registration.city} {gst_registration.pincode}")
    lines.append(f"GSTIN: {gst_registration.gstin} ({gst_registration.get_state_display()})")
    return [Paragraph(line, _BODY_STYLE) for line in lines]


def _buyer_block(invoice: Invoice) -> list:
    customer = invoice.customer
    lines = [f"<b>{customer.name}</b>"]
    address = customer.addresses.first()
    if address:
        if address.line1:
            lines.append(address.line1)
        if address.line2:
            lines.append(address.line2)
        location = " ".join(filter(None, [address.city, address.pincode]))
        if location:
            lines.append(location)
    if customer.phone:
        lines.append(f"Phone: {customer.phone}")
    if customer.gstin:
        lines.append(f"GSTIN: {customer.gstin}")
    return [Paragraph(line, _BODY_STYLE) for line in lines]


def _line_items_table(invoice: Invoice) -> Table:
    is_interstate = any(line.igst_amount for line in invoice.lines.all())
    if is_interstate:
        tax_headers = ["IGST"]
    else:
        tax_headers = ["CGST", "SGST"]

    headers = ["#", "Item", "Qty", "Rate", "Taxable", *tax_headers, "Total"]
    rows = [headers]
    for index, line in enumerate(invoice.lines.select_related("item").all(), start=1):
        tax_cells = [_money(line.igst_amount)] if is_interstate else [_money(line.cgst_amount), _money(line.sgst_amount)]
        rows.append([
            str(index),
            f"{line.item.name} ({line.item.sku})" + (" [Bonus]" if line.is_bonus else ""),
            f"{line.qty:g}",
            _money(line.rate),
            _money(line.taxable_amount),
            *tax_cells,
            _money(line.line_total),
        ])

    col_widths = [18, 170, 32, 55, 60] + [45] * len(tax_headers) + [60]
    table = Table(rows, colWidths=[w * 0.75 for w in col_widths], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))
    return table


def _totals_table(invoice: Invoice) -> Table:
    cgst_total = sum(line.cgst_amount for line in invoice.lines.all())
    sgst_total = sum(line.sgst_amount for line in invoice.lines.all())
    igst_total = sum(line.igst_amount for line in invoice.lines.all())

    rows = [["Subtotal", _money(invoice.subtotal)]]
    if invoice.discount_total:
        rows.append(["Discount", f"-{_money(invoice.discount_total)}"])
    if cgst_total:
        rows.append(["CGST", _money(cgst_total)])
    if sgst_total:
        rows.append(["SGST", _money(sgst_total)])
    if igst_total:
        rows.append(["IGST", _money(igst_total)])
    rows.append(["Grand Total", _money(invoice.grand_total)])

    table = Table(rows, colWidths=[80, 80])
    table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEABOVE", (0, -1), (-1, -1), 1, colors.HexColor("#1e293b")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
    ]))
    return table


def build_invoice_pdf_bytes(invoice: Invoice) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=24 * mm, bottomMargin=18 * mm, leftMargin=18 * mm, rightMargin=18 * mm)
    elements = []

    company = invoice.gst_registration.company
    header_cells = [_seller_block(invoice), [Paragraph("TAX INVOICE", _TITLE_STYLE)]]
    if company.logo:
        try:
            header_cells[1].insert(0, Image(company.logo.path, width=32 * mm, height=32 * mm, kind="proportional"))
        except (FileNotFoundError, OSError):
            # Missing/unreadable file on disk shouldn't block generating
            # the invoice itself — the PDF just renders without the logo.
            pass
    header = Table([[header_cells[0], header_cells[1]]], colWidths=[300, 180])
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    elements.append(header)
    elements.append(Spacer(1, 10 * mm))

    # Two-column layout: buyer block on the left, invoice meta on the right.
    buyer_lines = _buyer_block(invoice)
    meta_lines = [
        Paragraph("<b>Bill To</b>", _HEADING_STYLE), *buyer_lines,
    ]
    invoice_meta_lines = [
        Paragraph(f"<b>Invoice No:</b> {invoice.invoice_no or invoice.id}", _SMALL_STYLE),
        Paragraph(f"<b>Date:</b> {invoice.invoice_date.strftime('%d-%b-%Y')}", _SMALL_STYLE),
        Paragraph(f"<b>Place of Supply:</b> {invoice.get_place_of_supply_state_display()}", _SMALL_STYLE),
        Paragraph(f"<b>Payment Status:</b> {invoice.get_payment_status_display()}", _SMALL_STYLE),
    ]
    meta_table = Table([[meta_lines, invoice_meta_lines]], colWidths=[300, 180])
    meta_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    elements.append(meta_table)
    elements.append(Spacer(1, 8 * mm))

    elements.append(_line_items_table(invoice))
    elements.append(Spacer(1, 6 * mm))

    totals = _totals_table(invoice)
    upi_uri = build_upi_uri(invoice)
    if upi_uri:
        # §18: a static upi://pay QR, not a live gateway charge — any UPI
        # app can scan and pay this exact amount straight to Company.upi_vpa.
        qr_image = Image(io.BytesIO(build_upi_qr_png(upi_uri)), width=26 * mm, height=26 * mm)
        qr_block = [qr_image, Paragraph("Scan to pay via UPI", _SMALL_STYLE)]
        footer = Table([[qr_block, totals]], colWidths=[140, 340])
        footer.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("ALIGN", (1, 0), (1, -1), "RIGHT")]))
        elements.append(footer)
    else:
        totals_wrapper = Table([[totals]], colWidths=[480])
        totals_wrapper.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "RIGHT")]))
        elements.append(totals_wrapper)

    doc.build(elements)
    return buf.getvalue()


def invoice_pdf_response(invoice: Invoice) -> HttpResponse:
    content = build_invoice_pdf_bytes(invoice)
    response = HttpResponse(content, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{invoice.invoice_no or invoice.id}.pdf"'
    return response
