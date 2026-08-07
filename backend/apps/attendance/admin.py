from django.contrib import admin

from .models import Attendance


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ("agent", "check_in_at", "check_out_at")
    list_filter = ("agent",)
    search_fields = ("agent__username",)
