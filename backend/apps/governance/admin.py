from django.contrib import admin

from .models import ChangeRequest


@admin.register(ChangeRequest)
class ChangeRequestAdmin(admin.ModelAdmin):
    list_display = ("target_label", "status", "requested_by", "requested_at", "reviewed_by", "reviewed_at")
    list_filter = ("status",)
    readonly_fields = (
        "content_type", "object_id", "target_label", "proposed_changes", "previous_snapshot",
        "requested_by", "requested_at",
    )
