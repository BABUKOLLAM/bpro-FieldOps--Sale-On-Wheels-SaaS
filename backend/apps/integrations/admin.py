from django.contrib import admin

from .models import ERPConnection, SyncLogEntry, Webhook, WebhookDeliveryLog


@admin.register(ERPConnection)
class ERPConnectionAdmin(admin.ModelAdmin):
    list_display = ("erp_type", "sync_mode", "batch_interval_minutes", "is_active")


@admin.register(SyncLogEntry)
class SyncLogEntryAdmin(admin.ModelAdmin):
    list_display = ("entity_type", "local_object_id", "status", "retry_count", "erp_reference_id", "created_at")
    list_filter = ("status", "entity_type")
    readonly_fields = [f.name for f in SyncLogEntry._meta.fields]

    def has_add_permission(self, request):
        return False


@admin.register(Webhook)
class WebhookAdmin(admin.ModelAdmin):
    list_display = ("name", "url", "event_types", "is_active")


@admin.register(WebhookDeliveryLog)
class WebhookDeliveryLogAdmin(admin.ModelAdmin):
    list_display = ("webhook", "event_type", "status", "response_status_code", "created_at")
    list_filter = ("status", "event_type")
    readonly_fields = [f.name for f in WebhookDeliveryLog._meta.fields]

    def has_add_permission(self, request):
        return False
