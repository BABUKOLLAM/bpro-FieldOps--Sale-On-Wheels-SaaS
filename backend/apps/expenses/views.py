from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.constants import PERM_EXPENSES_APPROVE, PERM_EXPENSES_CREATE_OWN, PERM_EXPENSES_VIEW_ALL

from .models import Expense
from .serializers import ExpenseSerializer


def _can_view_all_expenses(user) -> bool:
    return user.is_superuser or PERM_EXPENSES_VIEW_ALL in user.permission_codes()


class ExpenseViewSet(viewsets.ModelViewSet):
    """Field expense capture + supervisor approval (FR-06, AR-10). A field
    agent sees/creates only their own expenses; supervisors/back-office/
    finance (holders of expenses.view_all) see every agent's."""

    queryset = Expense.objects.select_related("agent", "trip", "approved_by")
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["status", "category", "agent"]

    def get_queryset(self):
        if _can_view_all_expenses(self.request.user):
            return self.queryset
        return self.queryset.filter(agent=self.request.user)

    def perform_create(self, serializer):
        user = self.request.user
        if not (user.is_superuser or PERM_EXPENSES_CREATE_OWN in user.permission_codes()):
            raise PermissionDenied("Not allowed to submit expenses.")
        serializer.save(agent=serializer.validated_data.get("agent") or user)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        if PERM_EXPENSES_APPROVE not in request.user.permission_codes() and not request.user.is_superuser:
            raise PermissionDenied("Not allowed to approve expenses.")
        expense = self.get_object()
        expense.status = Expense.STATUS_APPROVED
        expense.approved_by = request.user
        expense.approved_at = timezone.now()
        expense.rejection_reason = ""
        expense.save(update_fields=["status", "approved_by", "approved_at", "rejection_reason"])
        return Response(self.get_serializer(expense).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        if PERM_EXPENSES_APPROVE not in request.user.permission_codes() and not request.user.is_superuser:
            raise PermissionDenied("Not allowed to reject expenses.")
        expense = self.get_object()
        expense.status = Expense.STATUS_REJECTED
        expense.approved_by = request.user
        expense.approved_at = timezone.now()
        expense.rejection_reason = request.data.get("reason", "")
        expense.save(update_fields=["status", "approved_by", "approved_at", "rejection_reason"])
        return Response(self.get_serializer(expense).data)
