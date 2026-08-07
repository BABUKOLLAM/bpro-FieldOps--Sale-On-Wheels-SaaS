from django.db import models

from apps.core.models import BaseModel


class Attendance(BaseModel):
    """FR-16 Attendance Check-In/Check-Out — daily start/end capture with
    an optional geo-tag and selfie, distinct from the per-outlet trip
    check-in/out (fleet.TripCheckpoint), which tracks visits *during* a
    trip rather than the workday itself.

    Client-generated PK — check-in follows the same offline-create
    idempotency rationale as Invoice/Trip/Expense (see apps.mobile_sync).
    Check-out is a separate authenticated action against an existing
    record (mirroring fleet.TripViewSet.start/end), not a second offline
    push of the same id — the generic push protocol only ever creates.
    """

    agent = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="attendance_records")
    check_in_at = models.DateTimeField()
    check_in_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    check_in_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    check_in_selfie = models.ImageField(upload_to="attendance_selfies/", null=True, blank=True)
    check_out_at = models.DateTimeField(null=True, blank=True)
    check_out_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    check_out_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    check_out_selfie = models.ImageField(upload_to="attendance_selfies/", null=True, blank=True)
    device_created_at = models.DateTimeField(
        null=True, blank=True, help_text="When check-in was actually captured on-device, for offline records."
    )

    class Meta:
        ordering = ["-check_in_at"]

    def duration_minutes(self):
        if not self.check_out_at:
            return None
        return int((self.check_out_at - self.check_in_at).total_seconds() // 60)

    def __str__(self):
        return f"{self.agent} — {self.check_in_at:%Y-%m-%d}"
