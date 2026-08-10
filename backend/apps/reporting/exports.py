"""AR-02 / FM-13: Excel and PDF export, and emailing, of the reports
already shown on-screen elsewhere in admin-web. Report data is built once
per request as (title, headers, rows) and rendered to whichever format
was asked for — the same content either way, never two sources of truth."""

import csv
import io

from django.core.mail import EmailMessage
from django.http import HttpResponse
from openpyxl import Workbook
from openpyxl.styles import Font
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def build_xlsx_bytes(title: str, headers: list[str], rows: list[list]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = title[:31] or "Report"
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True)
    for row in rows:
        ws.append([str(v) if v is not None else "" for v in row])
    for col in ws.columns:
        width = max((len(str(c.value)) for c in col if c.value is not None), default=10)
        ws.column_dimensions[col[0].column_letter].width = min(max(width + 2, 10), 40)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def build_csv_bytes(title: str, headers: list[str], rows: list[list]) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(["" if v is None else v for v in row])
    return buf.getvalue().encode("utf-8-sig")  # BOM so Excel opens non-ASCII (GSTIN/names) correctly


def build_pdf_bytes(title: str, headers: list[str], rows: list[list]) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    elements = [Paragraph(title, styles["Title"]), Spacer(1, 12)]

    data = [headers] + [[str(v) if v is not None else "" for v in row] for row in rows]
    if len(data) == 1:
        data.append(["No data for this report." if not headers else ""] * len(headers))
    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    elements.append(table)
    doc.build(elements)
    return buf.getvalue()


def file_response(fmt: str, filename: str, title: str, headers: list[str], rows: list[list]) -> HttpResponse:
    if fmt == "pdf":
        content = build_pdf_bytes(title, headers, rows)
        response = HttpResponse(content, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}.pdf"'
        return response
    content = build_xlsx_bytes(title, headers, rows)
    response = HttpResponse(
        content, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    response["Content-Disposition"] = f'attachment; filename="{filename}.xlsx"'
    return response


def email_report(to_email: str, fmt: str, filename: str, title: str, headers: list[str], rows: list[list]) -> None:
    if fmt == "pdf":
        content = build_pdf_bytes(title, headers, rows)
        mime, ext = "application/pdf", "pdf"
    else:
        content = build_xlsx_bytes(title, headers, rows)
        mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ext = "xlsx"
    email = EmailMessage(subject=f"Van Sales — {title}", body=f"Attached: {title}.", to=[to_email])
    email.attach(f"{filename}.{ext}", content, mime)
    email.send(fail_silently=False)
