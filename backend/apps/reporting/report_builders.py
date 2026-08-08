"""Row-oriented data for every exportable report (AR-02, FM-13). Each
builder returns (title, headers, rows) — the same shape exports.py renders
to Excel/PDF. Kept separate from views.py/exports.py so adding a report is
a one-function change in one place.
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


def attendance_report():
    from apps.attendance.models import Attendance

    rows = []
    for a in Attendance.objects.select_related("agent").order_by("-check_in_at")[:1000]:
        duration = a.duration_minutes()
        rows.append([
            a.check_in_at.date(), a.agent.get_full_name() or a.agent.username,
            a.check_in_at.strftime("%H:%M"), a.check_out_at.strftime("%H:%M") if a.check_out_at else "—",
            f"{duration // 60}h {duration % 60}m" if duration is not None else "—",
            "Yes" if a.check_in_latitude is not None else "No",
        ])
    return "Attendance Report", ["Date", "Agent", "Check-In", "Check-Out", "Duration", "Geo-Tagged"], rows


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


def fleet_compliance_report():
    from apps.fleet.services import compliance_due_alerts

    rows = [
        [
            a["holder"], a["document_type_display"], a["document_number"] or "—",
            a["expiry_date"], a["days_remaining"], a["status"],
        ]
        for a in compliance_due_alerts()
    ]
    return (
        "Vehicle & Driver Compliance Report",
        ["Vehicle / Driver", "Document", "Number", "Expiry Date", "Days Remaining", "Status"],
        rows,
    )


def fleet_geofence_report():
    from apps.fleet.services import geofence_alerts

    rows = [
        [
            a["agent_name"], a["vehicle_reg_no"] or "—", a["zone_name"],
            a["distance_meters"], a["recorded_at"],
        ]
        for a in geofence_alerts()
    ]
    return (
        "Geofence Alerts Report — restricted-zone entries, active trips",
        ["Agent", "Vehicle", "Zone", "Distance (m)", "Detected At"],
        rows,
    )


def fleet_route_analytics_report():
    from apps.fleet.services import trip_route_analytics

    rows = [
        [
            a["agent_name"], a["vehicle_reg_no"] or "—", a["beat_name"] or "—",
            a["start_time"], a["idle_minutes"], a["deviation_count"],
        ]
        for a in trip_route_analytics()
    ]
    return (
        "Fleet Route Analytics — idle time & route deviation, last 30 days",
        ["Agent", "Vehicle", "Beat", "Trip Start", "Idle Minutes", "Deviation Points"],
        rows,
    )


def driver_safety_scores_report():
    from apps.fleet.services import driver_safety_scores

    rows = [
        [s["agent_name"], s["trip_count"], s["avg_score"], s["total_speeding_events"], s["total_idle_minutes"]]
        for s in driver_safety_scores()
    ]
    return (
        "Driver Safety Scores — speeding & idling only, last 30 days",
        ["Agent", "Trips", "Avg Score", "Speeding Events", "Idle Minutes"],
        rows,
    )


def inventory_velocity_report():
    """FM-10: fast/slow movers and stock-out/overstock, by item across all
    van godowns — qty sold in the last 30 days from the stock ledger
    against current on-hand quantity."""
    from apps.inventory.models import Godown, StockLedgerEntry, VanStock

    cutoff = timezone.now() - timedelta(days=30)
    sold_by_item = {}
    for entry in (
        StockLedgerEntry.objects.filter(
            txn_type=StockLedgerEntry.TXN_SALE, created_at__gte=cutoff, godown__godown_type=Godown.TYPE_VAN,
        )
        .values("item_id", "item__sku", "item__name")
        .annotate(qty_sold=Sum("qty"))
    ):
        sold_by_item[entry["item_id"]] = {
            "sku": entry["item__sku"], "name": entry["item__name"], "qty_sold": abs(float(entry["qty_sold"] or 0)),
        }

    on_hand_by_item = {}
    for row in (
        VanStock.objects.filter(godown__godown_type=Godown.TYPE_VAN)
        .values("item_id")
        .annotate(qty=Sum("qty_on_hand"))
    ):
        on_hand_by_item[row["item_id"]] = float(row["qty"] or 0)

    item_ids = set(sold_by_item) | set(on_hand_by_item)
    rows = []
    for item_id in item_ids:
        sold = sold_by_item.get(item_id, {}).get("qty_sold", 0.0)
        on_hand = on_hand_by_item.get(item_id, 0.0)
        sku = sold_by_item.get(item_id, {}).get("sku", "—")
        name = sold_by_item.get(item_id, {}).get("name")
        if name is None:
            from apps.catalog.models import Item

            item = Item.objects.filter(id=item_id).first()
            sku, name = (item.sku, item.name) if item else ("—", "Unknown")
        daily_velocity = sold / 30
        if on_hand <= 0 and sold > 0:
            pattern = "Stock-out"
        elif daily_velocity > 0 and on_hand / daily_velocity > 21:
            pattern = "Overstock"
        elif sold == 0:
            pattern = "Slow-moving"
        else:
            pattern = "Fast-moving" if daily_velocity >= 1 else "Normal"
        rows.append([sku, name, sold, on_hand, round(daily_velocity, 2), pattern])

    rows.sort(key=lambda r: r[2], reverse=True)
    return (
        "Inventory Velocity Report — last 30 days, van stock",
        ["SKU", "Item", "Qty Sold", "Qty On Hand", "Daily Velocity", "Pattern"],
        rows,
    )


REPORT_BUILDERS = {
    "sales": sales_report,
    "collections": collections_report,
    "outstanding": outstanding_report,
    "returns": returns_report,
    "expenses": expenses_report,
    "attendance": attendance_report,
    "stock_movement": stock_movement_report,
    "fleet_utilization": fleet_utilization_report,
    "fleet_fuel_trend": fleet_fuel_trend_report,
    "fleet_maintenance": fleet_maintenance_report,
    "fleet_odometer": fleet_odometer_report,
    "fleet_reverse_logistics": fleet_reverse_logistics_report,
    "fleet_compliance": fleet_compliance_report,
    "fleet_geofence": fleet_geofence_report,
    "fleet_route_analytics": fleet_route_analytics_report,
    "driver_safety_scores": driver_safety_scores_report,
    "inventory_velocity": inventory_velocity_report,
}

REPORT_LABELS = {
    "sales": "Sales",
    "collections": "Collections",
    "outstanding": "Outstanding & Credit",
    "returns": "Returns & Replacements",
    "expenses": "Expenses",
    "attendance": "Attendance",
    "stock_movement": "Stock Movement",
    "fleet_utilization": "Fleet Utilization",
    "fleet_fuel_trend": "Fleet Fuel Cost Trend",
    "fleet_maintenance": "Fleet Maintenance Due",
    "fleet_odometer": "Fleet Odometer Log",
    "fleet_reverse_logistics": "Fleet Reverse Logistics",
    "fleet_compliance": "Fleet Compliance (Documents)",
    "fleet_geofence": "Fleet Geofence Alerts",
    "fleet_route_analytics": "Fleet Route Analytics (Idle/Deviation)",
    "driver_safety_scores": "Driver Safety Scores",
    "inventory_velocity": "Inventory Velocity",
}
