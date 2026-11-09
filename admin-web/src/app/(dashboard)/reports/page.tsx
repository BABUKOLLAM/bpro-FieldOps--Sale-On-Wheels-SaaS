import { apiGet } from "@/lib/api";
import EmailReportRow from "./EmailReportRow";
import { CARD_CLASS } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import DateRangeFilter from "@/components/DateRangeFilter";
import { apiRangeQuery } from "@/lib/dateRange";
import { readListParams } from "@/lib/listPage";

type ReportEntry = { key: string; label: string; supports_period?: boolean };

const DESCRIPTIONS: Record<string, string> = {
  sales: "Every invoice — date, customer, agent, amount, credit and sync status.",
  collections: "Every receipt — customer, agent, mode, amount, reference.",
  outstanding: "Current outstanding balance and credit status per customer.",
  returns: "Sales returns and replacements with reason codes.",
  expenses: "Field expense claims with category and approval status.",
  attendance: "Daily check-in/check-out times, duration, and whether each was geo-tagged.",
  stock_movement: "The stock ledger — van loads/unloads, sales, transfers, adjustments.",
  fleet_utilization: "Vehicle trips, distance, fuel cost, and efficiency — last 30 days.",
  fleet_fuel_trend: "Fuel cost by month — last 6 months.",
  fleet_maintenance: "Maintenance items due soon or overdue, across the fleet.",
  fleet_odometer: "Every odometer reading logged, per vehicle.",
  fleet_reverse_logistics: "Damaged/expired returns and whether they've been reconciled to the warehouse.",
  fleet_compliance: "Vehicle and driver documents (RC, insurance, permit, PUC, license) due for renewal.",
  fleet_geofence: "Active trips currently inside a restricted zone.",
  fleet_route_analytics: "Trips with notable idle time or GPS points off the assigned beat route — last 30 days.",
  driver_safety_scores: "Per-agent safety score from speeding and idling only — last 30 days.",
  trip_profitability: "Per-trip fuel + maintenance cost vs. revenue/collections — an estimate, last 30 days.",
  inventory_velocity: "Fast/slow-moving SKUs, stock-outs, and overstock across van stock — last 30 days.",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [reports, { range, error, context, query }] = await Promise.all([
    apiGet<ReportEntry[]>("/api/reporting/reports/"),
    readListParams(searchParams),
  ]);
  const hasRange = Boolean(range.from || range.to);
  // Report exports take period_start/period_end (backend apps/reporting/views.py).
  const periodQuery = apiRangeQuery(range, ["period_start", "period_end"]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Reports</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Every report below exports to Excel or PDF, or can be emailed directly (AR-02, FM-13).
          The period applies to dated reports; snapshot and fixed-window reports are marked.
        </p>
      </div>

      <DateRangeFilter value={range} context={context} query={query} error={error} label="Report period" />

      <div className={`${CARD_CLASS} divide-y divide-neutral-100 dark:divide-neutral-800`}>
        {reports.map((r) => (
          <div key={r.key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                {r.label}
                {hasRange && !r.supports_period && <Badge tone="neutral">ignores period</Badge>}
              </h3>
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{DESCRIPTIONS[r.key] || ""}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex gap-2">
                <a
                  href={`/api/proxy/reporting/export/${r.key}?filetype=xlsx${r.supports_period ? periodQuery : ""}`}
                  className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  Excel
                </a>
                <a
                  href={`/api/proxy/reporting/export/${r.key}?filetype=pdf${r.supports_period ? periodQuery : ""}`}
                  className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  PDF
                </a>
              </div>
              <EmailReportRow reportKey={r.key} period={r.supports_period ? range : undefined} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
