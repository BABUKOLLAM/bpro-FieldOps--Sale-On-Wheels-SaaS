import { apiGet } from "@/lib/api";
import EmailReportRow from "./EmailReportRow";

type ReportEntry = { key: string; label: string };

const DESCRIPTIONS: Record<string, string> = {
  sales: "Every invoice — date, customer, agent, amount, credit and sync status.",
  collections: "Every receipt — customer, agent, mode, amount, reference.",
  outstanding: "Current outstanding balance and credit status per customer.",
  returns: "Sales returns and replacements with reason codes.",
  expenses: "Field expense claims with category and approval status.",
  stock_movement: "The stock ledger — van loads/unloads, sales, transfers, adjustments.",
  fleet_utilization: "Vehicle trips, distance, fuel cost, and efficiency — last 30 days.",
  fleet_fuel_trend: "Fuel cost by month — last 6 months.",
  fleet_maintenance: "Maintenance items due soon or overdue, across the fleet.",
  fleet_odometer: "Every odometer reading logged, per vehicle.",
  fleet_reverse_logistics: "Damaged/expired returns and whether they've been reconciled to the warehouse.",
};

export default async function ReportsPage() {
  const reports = await apiGet<ReportEntry[]>("/api/reporting/reports/");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Reports</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Every report below exports to Excel or PDF, or can be emailed directly (AR-02, FM-13).
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
        {reports.map((r) => (
          <div key={r.key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{r.label}</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{DESCRIPTIONS[r.key] || ""}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex gap-2">
                <a
                  href={`/api/proxy/reporting/export/${r.key}?filetype=xlsx`}
                  className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Excel
                </a>
                <a
                  href={`/api/proxy/reporting/export/${r.key}?filetype=pdf`}
                  className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  PDF
                </a>
              </div>
              <EmailReportRow reportKey={r.key} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
