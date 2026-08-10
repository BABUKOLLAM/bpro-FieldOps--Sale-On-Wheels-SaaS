from django.http import Http404, HttpResponse
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.reporting.exports import build_csv_bytes, build_xlsx_bytes

from .entities import REGISTRY
from .models import ImportJob
from .parsing import parse_upload
from .serializers import ImportJobSerializer
from .services import export_headers, export_rows, headers, import_rows

FILE_KINDS = {
    "csv": ("text/csv", "csv", build_csv_bytes),
    "xlsx": (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xlsx",
        build_xlsx_bytes,
    ),
}


def _spec_or_404(slug):
    spec = REGISTRY.get(slug)
    if spec is None:
        raise Http404(f"Unknown master-data entity '{slug}'.")
    return spec


def _check_permission(request, spec):
    if request.user.is_superuser:
        return
    if spec.permission_code not in request.user.permission_codes():
        raise PermissionDenied("You don't have permission to manage this master data.")


def _file_response(fmt, filename, title, cols, rows):
    mime, ext, builder = FILE_KINDS.get(fmt, FILE_KINDS["xlsx"])
    response = HttpResponse(builder(title, cols, rows), content_type=mime)
    response["Content-Disposition"] = f'attachment; filename="{filename}.{ext}"'
    return response


class EntityListView(APIView):
    """Every master-data entity the current user is allowed to import or
    export, for the Import / Export hub page to render buttons for."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        is_super = request.user.is_superuser
        codes = request.user.permission_codes()
        data = [
            {"slug": spec.slug, "label": spec.label, "columns": headers(spec)}
            for spec in REGISTRY.values()
            if is_super or spec.permission_code in codes
        ]
        return Response(data)


class EntityTemplateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        spec = _spec_or_404(slug)
        _check_permission(request, spec)
        fmt = request.query_params.get("filetype", "xlsx")
        return _file_response(fmt, f"{slug}-template", f"{spec.label} template", headers(spec), [])


class EntityExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        spec = _spec_or_404(slug)
        _check_permission(request, spec)
        fmt = request.query_params.get("filetype", "xlsx")
        return _file_response(fmt, slug, spec.label, export_headers(spec), export_rows(spec))


class EntityImportView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request, slug):
        spec = _spec_or_404(slug)
        _check_permission(request, spec)
        upload = request.FILES.get("file")
        if not upload:
            return Response({"detail": "No file uploaded."}, status=400)
        try:
            dict_rows = parse_upload(upload)
        except Exception as exc:
            return Response({"detail": f"Could not read file: {exc}"}, status=400)

        result = import_rows(spec, dict_rows)
        job = ImportJob.objects.create(
            entity_slug=slug,
            file_name=upload.name,
            uploaded_by=request.user,
            created_count=result.created,
            updated_count=result.updated,
            error_count=len(result.errors),
            errors=result.errors,
        )
        return Response(ImportJobSerializer(job).data)


class ImportJobViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only audit trail. A user only ever sees jobs for entities they
    themselves have permission to import/export — the same scoping the
    hub page's entity list already applies, enforced here too so hitting
    this endpoint directly can't leak other teams' import history."""

    queryset = ImportJob.objects.order_by("-created_at")
    serializer_class = ImportJobSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        if not self.request.user.is_superuser:
            codes = self.request.user.permission_codes()
            visible_slugs = [spec.slug for spec in REGISTRY.values() if spec.permission_code in codes]
            qs = qs.filter(entity_slug__in=visible_slugs)
        slug = self.request.query_params.get("entity_slug")
        return qs.filter(entity_slug=slug) if slug else qs
