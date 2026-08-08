from django.contrib.contenttypes.models import ContentType
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.constants import PERM_CHANGE_REQUEST_APPROVE, PERM_MASTER_SETTINGS_MANAGE
from apps.accounts.permissions import HasRolePermission

from .models import ChangeRequest
from .serializers import ChangeRequestCreateSerializer, ChangeRequestReviewSerializer, ChangeRequestSerializer
from .services import get_by_slug, slug_for_model


class ChangeRequestViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin,
                            mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Propose → approve/reject workflow for every governed model (Role
    permission edits today; Master Settings from Phase 3). See
    apps.governance.services for the registry a target must be in, and
    apps.accounts.governance for the Role registration."""

    queryset = ChangeRequest.objects.select_related("content_type", "requested_by", "reviewed_by").all()
    serializer_class = ChangeRequestSerializer
    permission_classes = [HasRolePermission]
    filterset_fields = ["status"]
    required_permission_codes = {
        "list": PERM_MASTER_SETTINGS_MANAGE,
        "retrieve": PERM_MASTER_SETTINGS_MANAGE,
        "create": PERM_MASTER_SETTINGS_MANAGE,
        "approve": PERM_CHANGE_REQUEST_APPROVE,
        "reject": PERM_CHANGE_REQUEST_APPROVE,
    }

    def create(self, request, *args, **kwargs):
        input_serializer = ChangeRequestCreateSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        data = input_serializer.validated_data

        entry = get_by_slug(data["target_type"])
        if entry is None:
            raise ValidationError({"target_type": ["Unknown or ungoverned target type."]})

        model = entry["model"]
        target = get_object_or_404(model, pk=data["target_id"])

        changes = data["proposed_changes"]
        if not isinstance(changes, dict) or not changes:
            raise ValidationError({"proposed_changes": ["At least one field change is required."]})

        unknown_fields = set(changes) - set(entry["fields"])
        if unknown_fields:
            raise ValidationError({
                "proposed_changes": [f"Fields not governed for '{data['target_type']}': {sorted(unknown_fields)}"]
            })

        previous_snapshot = {field: getattr(target, field) for field in changes}

        change_request = ChangeRequest.objects.create(
            content_type=ContentType.objects.get_for_model(model),
            object_id=str(target.pk),
            target_label=str(target),
            proposed_changes=changes,
            previous_snapshot=previous_snapshot,
            reason=data["reason"],
            requested_by=request.user,
        )
        return Response(self.get_serializer(change_request).data, status=201)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        change_request = self.get_object()
        if change_request.status != ChangeRequest.STATUS_PENDING:
            raise ValidationError("Only pending change requests can be approved.")

        note_serializer = ChangeRequestReviewSerializer(data=request.data)
        note_serializer.is_valid(raise_exception=True)

        entry = get_by_slug(slug_for_model(change_request.content_type.model_class()))
        if entry is None:
            raise ValidationError("No handler registered for this change request's target.")

        target = change_request.target
        entry["apply"](target, change_request.proposed_changes)

        change_request.status = ChangeRequest.STATUS_APPROVED
        change_request.reviewed_by = request.user
        change_request.reviewed_at = timezone.now()
        change_request.review_note = note_serializer.validated_data["note"]
        change_request.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_note"])
        return Response(self.get_serializer(change_request).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        change_request = self.get_object()
        if change_request.status != ChangeRequest.STATUS_PENDING:
            raise ValidationError("Only pending change requests can be rejected.")

        note_serializer = ChangeRequestReviewSerializer(data=request.data)
        note_serializer.is_valid(raise_exception=True)

        change_request.status = ChangeRequest.STATUS_REJECTED
        change_request.reviewed_by = request.user
        change_request.reviewed_at = timezone.now()
        change_request.review_note = note_serializer.validated_data["note"]
        change_request.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_note"])
        return Response(self.get_serializer(change_request).data)
