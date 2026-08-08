from django.contrib import admin

from .models import PlatformAdmin, Tenant


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "db_name", "db_host", "is_active", "created_at")
    search_fields = ("name", "slug", "db_name")


@admin.register(PlatformAdmin)
class PlatformAdminAdmin(admin.ModelAdmin):
    list_display = ("email", "is_active", "created_at")
    readonly_fields = ("password", "last_login")
