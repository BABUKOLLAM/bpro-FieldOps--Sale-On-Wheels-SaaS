from django.contrib import admin

from .models import Godown, StockLedgerEntry, StockTransfer, StockTransferLine, VanStock


@admin.register(Godown)
class GodownAdmin(admin.ModelAdmin):
    list_display = ("name", "godown_type", "assigned_agent", "is_active")


@admin.register(StockLedgerEntry)
class StockLedgerEntryAdmin(admin.ModelAdmin):
    list_display = ("created_at", "godown", "item", "txn_type", "qty", "balance_after")
    list_filter = ("txn_type", "godown")
    readonly_fields = [f.name for f in StockLedgerEntry._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(VanStock)
class VanStockAdmin(admin.ModelAdmin):
    list_display = ("godown", "item", "qty_on_hand")
    list_filter = ("godown",)


class StockTransferLineInline(admin.TabularInline):
    model = StockTransferLine
    extra = 0


@admin.register(StockTransfer)
class StockTransferAdmin(admin.ModelAdmin):
    list_display = ("transfer_type", "from_godown", "to_godown", "agent", "status", "transfer_date")
    list_filter = ("transfer_type", "status")
    inlines = [StockTransferLineInline]
