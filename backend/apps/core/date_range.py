"""Shared From–To date-range filtering for every list API of dated records
(orders, invoices, receipts, credit notes, payment orders, expenses,
attendance, sync log, change requests) and for the report exports.

One contract everywhere:

- Query params ``date_from`` / ``date_to`` (report exports also accept
  ``period_start`` / ``period_end``), each strictly ``YYYY-MM-DD``.
- Both bounds are inclusive calendar days.
- A ``DateTimeField`` is compared against the tenant's local day, not UTC:
  ``date_to=2026-11-09`` keeps a receipt at 23:59 IST on the 9th and drops
  one at 00:00 IST on the 10th, even though both are on the 9th in UTC.
  The bounds become ``[from 00:00 local, to+1 00:00 local)`` so the
  column's index is still usable (no ``__date`` cast per row).
- When both bounds are given the span is capped at
  ``settings.DATE_RANGE_MAX_SPAN_DAYS`` (default 366 — a full financial
  year including a leap day) so a single request can't scan years.
- Neither bound given = no filtering at all, so existing callers (the
  mobile app, older admin-web builds) keep their exact behaviour.

The filter runs inside ``filter_queryset``, i.e. *after* ``get_queryset``
has applied role scoping (an agent sees only their own rows) and on
whatever tenant database the request was routed to — it can only narrow
those results, never widen them.
"""

import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.filters import BaseFilterBackend

_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

DEFAULT_MAX_SPAN_DAYS = 366


def max_span_days() -> int:
    return int(getattr(settings, "DATE_RANGE_MAX_SPAN_DAYS", DEFAULT_MAX_SPAN_DAYS))


def tenant_timezone(request=None):
    """The timezone "a day" is measured in. Tenants have no per-tenant
    timezone setting today (apps.tenancy.Tenant has no such field), so this
    is the deployment's TIME_ZONE (Asia/Kolkata by default). Kept as one
    function so a per-tenant setting only has to be wired in here."""
    tz_name = getattr(getattr(request, "tenant", None), "timezone", None)
    if tz_name:
        from zoneinfo import ZoneInfo

        return ZoneInfo(tz_name)
    return timezone.get_default_timezone()


def parse_iso_date(value: str, param: str) -> date:
    if not _ISO_DATE.match(value or ""):
        raise ValidationError({param: "Use YYYY-MM-DD."})
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError({param: "Not a real calendar date."}) from None


@dataclass(frozen=True)
class DateRange:
    start: date | None
    end: date | None

    @property
    def is_set(self) -> bool:
        return self.start is not None or self.end is not None

    def label(self) -> str:
        if self.start and self.end:
            return f"{self.start.isoformat()} to {self.end.isoformat()}"
        if self.start:
            return f"from {self.start.isoformat()}"
        if self.end:
            return f"up to {self.end.isoformat()}"
        return ""


def parse_date_range(params, from_keys=("date_from",), to_keys=("date_to",)) -> DateRange:
    """Read and validate a range from a QueryDict / dict. Raises DRF
    ValidationError (→ HTTP 400) on any malformed input."""

    def pick(keys):
        for key in keys:
            raw = params.get(key)
            if raw not in (None, ""):
                return key, str(raw).strip()
        return keys[0], None

    from_key, raw_from = pick(from_keys)
    to_key, raw_to = pick(to_keys)
    start = parse_iso_date(raw_from, from_key) if raw_from is not None else None
    end = parse_iso_date(raw_to, to_key) if raw_to is not None else None

    if start and end:
        if start > end:
            raise ValidationError({from_key: f"{from_key} must be on or before {to_key}."})
        span = (end - start).days + 1
        limit = max_span_days()
        if span > limit:
            raise ValidationError(
                {to_key: f"Date range is {span} days; the maximum is {limit} days."}
            )
    return DateRange(start, end)


def apply_date_range(queryset, field_name: str, date_range: DateRange, tz=None):
    """Narrow ``queryset`` to ``date_range`` on ``field_name`` (a DateField
    or DateTimeField on the queryset's model; ``__`` paths allowed)."""
    if not date_range.is_set:
        return queryset

    field = _resolve_field(queryset.model, field_name)
    if isinstance(field, models.DateTimeField):
        tz = tz or tenant_timezone()
        if date_range.start:
            start_dt = timezone.make_aware(datetime.combine(date_range.start, time.min), tz)
            queryset = queryset.filter(**{f"{field_name}__gte": start_dt})
        if date_range.end:
            end_dt = timezone.make_aware(datetime.combine(date_range.end + timedelta(days=1), time.min), tz)
            queryset = queryset.filter(**{f"{field_name}__lt": end_dt})
        return queryset

    if date_range.start:
        queryset = queryset.filter(**{f"{field_name}__gte": date_range.start})
    if date_range.end:
        queryset = queryset.filter(**{f"{field_name}__lte": date_range.end})
    return queryset


def _resolve_field(model, path: str):
    parts = path.split("__")
    for part in parts[:-1]:
        model = model._meta.get_field(part).related_model
    return model._meta.get_field(parts[-1])


class DateRangeFilterBackend(BaseFilterBackend):
    """DRF filter backend: add to a view's ``filter_backends`` and set
    ``date_range_field`` on the view."""

    def filter_queryset(self, request, queryset, view):
        field_name = getattr(view, "date_range_field", None)
        if not field_name:
            return queryset
        date_range = parse_date_range(request.query_params)
        return apply_date_range(queryset, field_name, date_range, tz=tenant_timezone(request))

    def get_schema_operation_parameters(self, view):
        field_name = getattr(view, "date_range_field", None)
        if not field_name:
            return []
        description = (
            f"Inclusive {{}} on {field_name} (YYYY-MM-DD, tenant-local day). "
            f"Max span {max_span_days()} days when both bounds are given."
        )
        return [
            {
                "name": "date_from", "required": False, "in": "query",
                "description": description.format("start"), "schema": {"type": "string", "format": "date"},
            },
            {
                "name": "date_to", "required": False, "in": "query",
                "description": description.format("end"), "schema": {"type": "string", "format": "date"},
            },
        ]
