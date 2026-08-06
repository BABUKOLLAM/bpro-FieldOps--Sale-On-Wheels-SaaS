from django.contrib import admin

from .models import PushRequestLog


@admin.register(PushRequestLog)
class PushRequestLogAdmin(admin.ModelAdmin):
    list_display = ("entity_type", "idempotency_key", "device", "status", "created_at")
    list_filter = ("status", "entity_type")

    def has_add_permission(self, request):
        return False
