from django.contrib import admin

from .models import DeviceToken, NotificationLog


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "platform", "provider", "is_active", "created_at")
    list_filter = ("platform", "provider", "is_active")
    search_fields = ("user__username", "token")


@admin.register(NotificationLog)
class NotificationLogAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "channel", "device_count", "created_at")
    list_filter = ("channel",)
    search_fields = ("title", "user__username")
