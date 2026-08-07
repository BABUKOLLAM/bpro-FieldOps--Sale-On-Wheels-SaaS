from django.db import models

from apps.core.models import BaseModel


class Vehicle(BaseModel):
    reg_no = models.CharField(max_length=20, unique=True)
    vehicle_type = models.CharField(max_length=50, blank=True, help_text="e.g. Tempo, Mini-truck, Van")
    assigned_agent = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="vehicles"
    )
    fuel_type = models.CharField(max_length=20, blank=True, default="diesel")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.reg_no


class Trip(BaseModel):
    """One trip record spans both vehicle usage (FM-01) and the sales-side
    Trip Start/Trip End workflow (FR-08) — Invoice/Receipt/CreditNote and
    StockTransfer all optionally reference the same Trip."""

    STATUS_PLANNED = "planned"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_COMPLETED = "completed"
    STATUS_CHOICES = [
        (STATUS_PLANNED, "Planned"), (STATUS_IN_PROGRESS, "In progress"), (STATUS_COMPLETED, "Completed"),
    ]

    vehicle = models.ForeignKey(Vehicle, null=True, blank=True, on_delete=models.SET_NULL, related_name="trips")
    agent = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="trips")
    beat = models.ForeignKey("customers.Beat", null=True, blank=True, on_delete=models.SET_NULL, related_name="trips")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PLANNED)

    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    start_odometer = models.DecimalField(max_digits=10, decimal_places=1, null=True, blank=True)
    end_odometer = models.DecimalField(max_digits=10, decimal_places=1, null=True, blank=True)
    start_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    start_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    end_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    end_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    @property
    def distance_travelled(self):
        if self.start_odometer is None or self.end_odometer is None:
            return None
        return self.end_odometer - self.start_odometer

    def __str__(self):
        return f"Trip {self.id} — {self.agent} ({self.status})"


class TripCheckpoint(BaseModel):
    """Outlet-level check-in/check-out within a trip (FR-08)."""

    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="checkpoints")
    customer = models.ForeignKey("customers.Customer", on_delete=models.PROTECT, related_name="+")
    check_in_time = models.DateTimeField(null=True, blank=True)
    check_out_time = models.DateTimeField(null=True, blank=True)
    check_in_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    check_in_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    check_out_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    check_out_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True)

    @property
    def visit_duration_seconds(self):
        if self.check_in_time and self.check_out_time:
            return (self.check_out_time - self.check_in_time).total_seconds()
        return None

    def __str__(self):
        return f"{self.trip_id} — {self.customer}"


class OdometerLog(BaseModel):
    READING_START = "start"
    READING_END = "end"
    READING_INTERIM = "interim"
    READING_TYPE_CHOICES = [
        (READING_START, "Trip start"), (READING_END, "Trip end"), (READING_INTERIM, "Interim"),
    ]

    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="odometer_logs")
    trip = models.ForeignKey(Trip, null=True, blank=True, on_delete=models.SET_NULL, related_name="odometer_logs")
    reading_type = models.CharField(max_length=10, choices=READING_TYPE_CHOICES)
    reading = models.DecimalField(max_digits=10, decimal_places=1)
    photo = models.ImageField(upload_to="odometer_photos/", null=True, blank=True)
    recorded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.vehicle} {self.reading_type} {self.reading}"


class FuelLog(BaseModel):
    """Fuel fill-ups, with a simple flag for abnormal consumption that may
    indicate pilferage (FM-04)."""

    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="fuel_logs")
    trip = models.ForeignKey(Trip, null=True, blank=True, on_delete=models.SET_NULL, related_name="fuel_logs")
    fuel_qty_litres = models.DecimalField(max_digits=8, decimal_places=2)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    odometer_reading = models.DecimalField(max_digits=10, decimal_places=1)
    station = models.CharField(max_length=150, blank=True)
    filled_at = models.DateTimeField()
    flagged_for_review = models.BooleanField(default=False)
    flag_reason = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"{self.vehicle} — {self.fuel_qty_litres}L @ {self.odometer_reading}"


class MaintenanceSchedule(BaseModel):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="maintenance_schedules")
    description = models.CharField(max_length=255)
    interval_km = models.PositiveIntegerField(null=True, blank=True)
    interval_days = models.PositiveIntegerField(null=True, blank=True)
    next_due_odometer = models.DecimalField(max_digits=10, decimal_places=1, null=True, blank=True)
    next_due_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.vehicle} — {self.description}"


class LocationPing(BaseModel):
    """A single GPS breadcrumb (FR-05 real-time field tracking, FM-02
    vehicle tracking). Client-generated UUID PK — same idempotency
    rationale as every other mobile-pushed entity.

    Deliberately minimal: at scale (hundreds of agents pinging every few
    minutes across a working day) this table grows fast, and a production
    deployment should partition it by month and define a retention/
    archival policy. Not built here — an intentional MVP simplification,
    flagged rather than silently skipped, matching the original
    architecture notes for this feature (see docs/architecture.md)."""

    agent = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="location_pings")
    vehicle = models.ForeignKey(Vehicle, null=True, blank=True, on_delete=models.SET_NULL, related_name="location_pings")
    trip = models.ForeignKey(Trip, null=True, blank=True, on_delete=models.SET_NULL, related_name="location_pings")
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    recorded_at = models.DateTimeField()

    class Meta:
        ordering = ["-recorded_at"]
        indexes = [models.Index(fields=["agent", "-recorded_at"])]

    def __str__(self):
        return f"{self.agent} @ {self.latitude},{self.longitude} ({self.recorded_at:%Y-%m-%d %H:%M})"


class MaintenanceRecord(BaseModel):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="maintenance_records")
    schedule = models.ForeignKey(
        MaintenanceSchedule, null=True, blank=True, on_delete=models.SET_NULL, related_name="records"
    )
    service_date = models.DateField()
    odometer_reading = models.DecimalField(max_digits=10, decimal_places=1)
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    description = models.CharField(max_length=255)

    def __str__(self):
        return f"{self.vehicle} — {self.description} ({self.service_date})"
