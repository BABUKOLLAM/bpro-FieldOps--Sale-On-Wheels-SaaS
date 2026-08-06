from django.contrib import admin

from .models import Target


@admin.register(Target)
class TargetAdmin(admin.ModelAdmin):
    list_display = ("agent", "beat", "metric", "period_start", "period_end", "target_amount")
