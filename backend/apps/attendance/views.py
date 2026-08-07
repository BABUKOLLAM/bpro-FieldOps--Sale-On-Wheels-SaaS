from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.constants import PERM_ATTENDANCE_CREATE_OWN, PERM_ATTENDANCE_VIEW_ALL

from .models import Attendance
from .serializers import AttendanceSerializer


def _can_view_all(user) -> bool:
    return user.is_superuser or PERM_ATTENDANCE_VIEW_ALL in user.permission_codes()


class AttendanceViewSet(viewsets.ModelViewSet):
    """FR-16 — a field agent sees/creates only their own records;
    supervisors/back-office/finance (holders of attendance.view_all) see
    every agent's, for the "feeding into supervisor/HR reporting" half of
    the requirement."""

    queryset = Attendance.objects.select_related("agent")
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["agent"]

    def get_queryset(self):
        if _can_view_all(self.request.user):
            return self.queryset
        return self.queryset.filter(agent=self.request.user)

    def perform_create(self, serializer):
        user = self.request.user
        if not (user.is_superuser or PERM_ATTENDANCE_CREATE_OWN in user.permission_codes()):
            raise PermissionDenied("Not allowed to check in.")
        agent = serializer.validated_data.get("agent") or user
        if Attendance.objects.filter(agent=agent, check_out_at__isnull=True).exists():
            raise ValidationError("Already checked in — check out before checking in again.")
        serializer.save(agent=agent, check_in_at=serializer.validated_data.get("check_in_at") or timezone.now())

    @action(detail=False, methods=["get"])
    def open(self, request):
        """The requesting agent's current checked-in-but-not-out record,
        if any — so the mobile app can check out without having cached
        the record's id locally."""
        record = Attendance.objects.filter(agent=request.user, check_out_at__isnull=True).first()
        if not record:
            return Response(None)
        return Response(self.get_serializer(record).data)

    @action(detail=True, methods=["post"])
    def check_out(self, request, pk=None):
        record = self.get_object()
        if record.agent_id != request.user.id and not _can_view_all(request.user):
            raise PermissionDenied("Not allowed to check out on another agent's behalf.")
        if record.check_out_at:
            raise ValidationError("Already checked out.")
        record.check_out_at = timezone.now()
        record.check_out_latitude = request.data.get("latitude")
        record.check_out_longitude = request.data.get("longitude")
        record.save(update_fields=["check_out_at", "check_out_latitude", "check_out_longitude"])
        return Response(self.get_serializer(record).data)
