"""Row-oriented data for every exportable report (AR-02, FM-13). Each
builder returns (title, headers, rows) — the same shape exports.py renders
to Excel/PDF. Kept separate from views.py/exports.py so adding a report is
a one-function change in one place.

Deliberately not covered: an "attendance" report (AR-02 lists one) — there
is no Attendance model yet (FR-16 isn't built), so a report for it would
have nothing real to show.
"""

from datetime import timedelta

from django.db.models import Sum
from django.utils import timezone


def sales_report():
    from apps.sales.models import Invoice

    rows = [
        [
            inv.invoice_date, inv.invoice_no or str(inv.id)[:8], inv.customer.name,
            inv.agent.get_full_name() or inv.agent.username, float(inv.grand_total),
            inv.credit_check_status, inv.sync_status,
        ]
        for inv in Invoice.objects.select_related("customer", "agent").order_by("-invoice_date")[:1000]
    ]
    return "Sales Report", ["Date", "Invoice No", "Customer", "Agent", "Amount", "Credit Status", "Sync Status"], rows


def collections_report():
    from apps.sales.models import Receipt

    rows = [
        [
            r.received_at.date(), r.receipt_no or str(r.id)[:8], r.customer.name,
            r.agent.get_full_name() or r.agent.username, r.get_mode_display(), float(r.amount), r.reference_no,
        ]
        for r in Receipt.objects.select_related("customer", "agent").order_by("-received_at")[:1000]
    ]
    return "Collections Report", ["Date", "Receipt No", "Customer", "Agent", "Mode", "Amount", "Reference"], rows


def outstanding_report():
    from apps.customers.models import Customer

    rows = [
        [
            c.code, c.name, float(c.credit_limit), float(c.outstanding_balance),
            "Blocked" if c.is_blocked else c.credit_status(), c.credit_days,
        ]
        for c in Customer.objects.filter(is_active=True).order_by("-outstanding_balance")
    ]
    return (
        "Outstanding & Credit Report",
        ["Code", "Customer", "Credit Limit", "Outstanding", "Status", "Credit Days"],
        rows,
    )


def returns_report():
    from apps.sales.models import CreditNote

    rows = [
        [
            cn.note_date, cn.credit_note_no or str(cn.id)[:8], cn.customer.name,
            cn.agent.get_full_name() or cn.agent.username, cn.reason_code, float(cn.grand_total), cn.sync_status,
        ]
        for cn in CreditNote.objects.select_related("customer", "agent").order_by("-note_date")[:1000]
    ]
    return (
        "Returns & Replacements Report",
        ["Date", "Credit Note No", "Customer", "Agent", "Reason", "Amount", "Sync Status"],
        rows,
    )


def expenses_report():
    from apps.expenses.models import Expense

    rows = [
        [
            e.expense_date, e.agent.get_full_name() or e.agent.username, e.get_category_display(),
            float(e.amount), e.description, e.status,
        ]
        for e in Expense.objects.select_related("agent").order_by("-expense_date")[:1000]
    ]
    return "Expense Report", ["Date", "Agent", "Category", "Amount", "Description", "Status"], rows


def stock_movement_report():
    from apps.inventory.models import StockLedgerEntry

    rows = [
        [
            e.created_at.date(), e.godown.name, e.item.name, e.get_txn_type_display(),
            float(e.qty), float(e.balance_after),
        ]
        for e in StockLedgerEntry.objects.select_related("godown", "item").order_by("-created_at")[:1000]
    ]
    return "Stock Movement Report", ["Date", "Godown", "Item", "Transaction", "Qty", "Balance After"], rows


def fleet_utilization_report():
    from apps.fleet.models import FuelLog, Trip, Vehicle

    cutoff = timezone.now() - timedelta(days=30)
    rows = []
    for vehicle in Vehicle.objects.filter(is_active=True).select_related("assigned_agent"):
        trips = list(Trip.objects.filter(vehicle=vehicle, start_time__gte=cutoff))
        distance = sum((t.distance_travelled or 0) for t in trips)
        fuel_agg = FuelLog.objects.filter(vehicle=vehicle, filled_at__gte=cutoff).aggregate(
            cost=Sum("amount"), litres=Sum("fuel_qty_litres")
        )
        fuel_cost = fuel_agg["cost"] or 0
        fuel_litres = fuel_agg["litres"] or 0
        efficiency = round(float(distance) / float(fuel_litres), 1) if fuel_litres else None
        agent = vehicle.assigned_agent
        rows.append([
            vehicle.reg_no, (agent.get_full_name() or agent.username) if agent else "—",
            len(trips), float(distance), float(fuel_cost), efficiency if efficiency is not None else "—",
        ])
    return (
        "Fleet Utilization Report — last 30 days",
        ["Vehicle", "Agent", "Trips", "Distance (km)", "Fuel Cost", "Efficiency (km/l)"],
        rows,
    )


def fleet_fuel_trend_report():
    from django.db.models.functions import TruncMonth

    from apps.fleet.models import FuelLog

    cutoff = timezone.localdate().replace(day=1) - timedelta(days=180)
    qs = (
        FuelLog.objects.filter(filled_at__gte=cutoff)
        .annotate(month=TruncMonth("filled_at"))
        .values("month")
        .annotate(total_cost=Sum("amount"))
        .order_by("month")
    )
    rows = [[row["month"].strftime("%Y-%m"), float(row["total_cost"] or 0)] for row in qs]
    return "Fleet Fuel Cost Trend — last 6 months", ["Month", "Total Fuel Cost"], rows


def fleet_maintenance_report():
    from apps.fleet.services import maintenance_due_alerts

    rows = [
        [
            a["vehicle_reg_no"], a["description"], a["next_due_date"] or "—",
            a["next_due_odometer"] or "—", a["current_odometer"] or "—", a["status"],
        ]
        for a in maintenance_due_alerts()
    ]
    return (
        "Fleet Maintenance Due Report",
        ["Vehicle", "Item", "Due Date", "Due Odometer", "Current Odometer", "Status"],
        rows,
    )


def fleet_odometer_report():
    from apps.fleet.models import OdometerLog

    rows = [
        [
            log.recorded_at.date(), log.vehicle.reg_no, log.get_reading_type_display(), float(log.reading),
            log.trip_id or "—",
        ]
        for log in OdometerLog.objects.select_related("vehicle").order_by("-recorded_at")[:1000]
    ]
    return "Fleet Odometer Log", ["Date", "Vehicle", "Reading Type", "Reading (km)", "Trip"], rows


def fleet_reverse_logistics_report():
    from apps.inventory.models import StockTransfer
    from apps.sales.models import CreditNote, CreditNoteLine

    today = timezone.localdate()
    damaged_lines = CreditNoteLine.objects.filter(
        condition__in=[CreditNote.CONDITION_DAMAGED, CreditNote.CONDITION_EXPIRED],
        credit_note__note_date__gte=today - timedelta(days=30),
    ).select_related("credit_note", "credit_note__agent", "item")

    rows = []
    for line in damaged_lines:
        note = line.credit_note
        reconciled = StockTransfer.objects.filter(
            transfer_type=StockTransfer.TYPE_VAN_UNLOAD, agent=note.agent,
            transfer_date=note.note_date, status=StockTransfer.STATUS_COMPLETED,
        ).exists()
        rows.append([
            note.credit_note_no or str(note.id)[:8], note.agent.get_full_name() or note.agent.username,
            line.item.name, float(line.qty), line.condition, note.note_date, "Yes" if reconciled else "No",
        ])
    return (
        "Fleet Reverse Logistics Report — last 30 days",
        ["Credit Note", "Agent", "Item", "Qty", "Condition", "Date", "Reconciled"],
        rows,
    )


REPORT_BUILDERS = {
    "sales": sales_report,
    "collections": collections_report,
    "outstanding": outstanding_report,
    "returns": returns_report,
    "expenses": expenses_report,
    "stock_movement": stock_movement_report,
    "fleet_utilization": fleet_utilization_report,
    "fleet_fuel_trend": fleet_fuel_trend_report,
    "fleet_maintenance": fleet_maintenance_report,
    "fleet_odometer": fleet_odometer_report,
    "fleet_reverse_logistics": fleet_reverse_logistics_report,
}

REPORT_LABELS = {
    "sales": "Sales",
    "collections": "Collections",
    "outstanding": "Outstanding & Credit",
    "returns": "Returns & Replacements",
    "expenses": "Expenses",
    "stock_movement": "Stock Movement",
    "fleet_utilization": "Fleet Utilization",
    "fleet_fuel_trend": "Fleet Fuel Cost Trend",
    "fleet_maintenance": "Fleet Maintenance Due",
    "fleet_odometer": "Fleet Odometer Log",
    "fleet_reverse_logistics": "Fleet Reverse Logistics",
}
