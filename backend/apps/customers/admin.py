from django.contrib import admin

from .models import Beat, BeatCustomer, Customer, CustomerAddress, CustomerCategory


@admin.register(CustomerCategory)
class CustomerCategoryAdmin(admin.ModelAdmin):
    list_display = ("name",)


class CustomerAddressInline(admin.TabularInline):
    model = CustomerAddress
    extra = 0


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "category", "credit_limit", "outstanding_balance", "is_blocked", "is_active")
    search_fields = ("code", "name", "gstin", "phone")
    list_filter = ("is_blocked", "is_active", "category")
    inlines = [CustomerAddressInline]


class BeatCustomerInline(admin.TabularInline):
    model = BeatCustomer
    extra = 0


@admin.register(Beat)
class BeatAdmin(admin.ModelAdmin):
    list_display = ("name", "assigned_agent", "is_active")
    inlines = [BeatCustomerInline]
