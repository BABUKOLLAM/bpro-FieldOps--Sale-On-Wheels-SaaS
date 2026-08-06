from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import AuditLog, Device, Role, User, UserRole


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("username", "employee_code", "email", "is_field_agent", "is_active")
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Field App", {"fields": ("phone", "employee_code", "is_field_agent", "reporting_manager")}),
    )


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active")


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "scope_gst_registration")


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ("user", "device_id", "platform", "is_active", "last_synced_at")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("actor", "action", "created_at")
    readonly_fields = [f.name for f in AuditLog._meta.fields]
    list_filter = ("action",)

    def has_add_permission(self, request):
        return False
