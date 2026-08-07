from django.contrib import admin

from .models import (
    FuelLog, LocationPing, MaintenanceRecord, MaintenanceSchedule, OdometerLog, Trip, TripCheckpoint, Vehicle,
)


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ("reg_no", "vehicle_type", "assigned_agent", "is_active")


class TripCheckpointInline(admin.TabularInline):
    model = TripCheckpoint
    extra = 0


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ("id", "agent", "vehicle", "status", "start_time", "end_time")
    list_filter = ("status",)
    inlines = [TripCheckpointInline]


@admin.register(OdometerLog)
class OdometerLogAdmin(admin.ModelAdmin):
    list_display = ("vehicle", "trip", "reading_type", "reading", "recorded_at")


@admin.register(FuelLog)
class FuelLogAdmin(admin.ModelAdmin):
    list_display = ("vehicle", "fuel_qty_litres", "amount", "odometer_reading", "flagged_for_review", "filled_at")
    list_filter = ("flagged_for_review",)


@admin.register(MaintenanceSchedule)
class MaintenanceScheduleAdmin(admin.ModelAdmin):
    list_display = ("vehicle", "description", "next_due_date", "next_due_odometer", "is_active")


@admin.register(MaintenanceRecord)
class MaintenanceRecordAdmin(admin.ModelAdmin):
    list_display = ("vehicle", "description", "service_date", "odometer_reading", "cost")


@admin.register(LocationPing)
class LocationPingAdmin(admin.ModelAdmin):
    list_display = ("agent", "vehicle", "trip", "latitude", "longitude", "recorded_at")
    list_filter = ("agent",)
