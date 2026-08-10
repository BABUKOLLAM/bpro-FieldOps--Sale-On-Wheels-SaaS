from django.contrib import admin

from .models import ImportJob


@admin.register(ImportJob)
class ImportJobAdmin(admin.ModelAdmin):
    list_display = ("entity_slug", "file_name", "uploaded_by", "created_count", "updated_count", "error_count", "created_at")
    list_filter = ("entity_slug",)
    readonly_fields = [f.name for f in ImportJob._meta.fields]
