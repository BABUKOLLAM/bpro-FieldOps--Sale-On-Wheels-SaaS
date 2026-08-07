from django.contrib import admin

from .models import Expense


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("agent", "category", "amount", "expense_date", "status", "approved_by")
    list_filter = ("status", "category")
    search_fields = ("agent__username", "description")
