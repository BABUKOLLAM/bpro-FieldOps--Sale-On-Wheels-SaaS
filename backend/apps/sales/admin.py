from django.contrib import admin

from .models import (
    CreditNote, CreditNoteLine, Invoice, InvoiceLine, PaymentAllocation,
    Receipt, SalesOrder, SalesOrderLine,
)


class SalesOrderLineInline(admin.TabularInline):
    model = SalesOrderLine
    extra = 0


@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    list_display = ("order_no", "customer", "agent", "order_date", "status")
    inlines = [SalesOrderLineInline]


class InvoiceLineInline(admin.TabularInline):
    model = InvoiceLine
    extra = 0


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = (
        "invoice_no", "customer", "agent", "invoice_date", "grand_total",
        "payment_status", "credit_check_status", "sync_status",
    )
    list_filter = ("payment_status", "credit_check_status", "sync_status", "source")
    search_fields = ("invoice_no", "customer__name")
    inlines = [InvoiceLineInline]


class PaymentAllocationInline(admin.TabularInline):
    model = PaymentAllocation
    extra = 0


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ("receipt_no", "customer", "agent", "mode", "amount", "received_at", "sync_status")
    inlines = [PaymentAllocationInline]


class CreditNoteLineInline(admin.TabularInline):
    model = CreditNoteLine
    extra = 0


@admin.register(CreditNote)
class CreditNoteAdmin(admin.ModelAdmin):
    list_display = ("credit_note_no", "customer", "original_invoice", "note_date", "grand_total", "sync_status")
    inlines = [CreditNoteLineInline]
