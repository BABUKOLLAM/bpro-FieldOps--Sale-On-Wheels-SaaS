import { apiGet } from "@/lib/api";
import ExportCsvButton from "@/components/ExportCsvButton";

type StockVarianceAlert = {
  entry_id: string;
  godown_name: string;
  item_sku: string;
  item_name: string;
  qty: number;
  balance_after: number;
  recorded_at: string;
};

type UnusualDiscountAlert = {
  invoice_id: string;
  invoice_no: string;
  invoice_date: string;
  customer_name: string;
  agent_name: string;
  subtotal: number;
  discount_total: number;
  discount_pct: number;
};

type MissedVisitAlert = {
  trip_id: string;
  beat_name: string;
  agent_name: string;
  visit_sequence: number;
  customer_name: string;
  date: string;
};

type InactiveAgentAlert = {
  agent_id: string;
  agent_name: string;
  last_activity_at: string | null;
  days_inactive: number | null;
};

type AlertsSummary = {
  stock_variance: StockVarianceAlert[];
  unusual_discounts: UnusualDiscountAlert[];
  missed_visits: MissedVisitAlert[];
  inactive_agents: InactiveAgentAlert[];
};

// Explicit locale + timeZone (not the runtime default) so the server-
// rendered HTML and the browser's client-side render always agree —
// leaving these implicit is a classic Next.js hydration-mismatch source
// (the Node SSR process and the visitor's browser rarely share a locale/TZ).
function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function ReportLinks({ reportKey }: { reportKey: string }) {
  return (
    <div className="flex gap-2">
      <a
        href={`/api/proxy/reporting/export/${reportKey}?filetype=xlsx`}
        className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
      >
        Excel
      </a>
      <a
        href={`/api/proxy/reporting/export/${reportKey}?filetype=pdf`}
        className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
      >
        PDF
      </a>
    </div>
  );
}

function SectionHeader({
  title, subtitle, count, reportKey, csvData, csvFilename,
}: {
  title: string; subtitle: string; count: number; reportKey: string; csvData: Record<string, unknown>[]; csvFilename: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-neutral-200 dark:border-neutral-800 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          {title} <span className="font-normal text-neutral-400">({count})</span>
        </h2>
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        <ExportCsvButton data={csvData} filename={csvFilename} />
        <ReportLinks reportKey={reportKey} />
      </div>
    </div>
  );
}

export default async function AlertsPage() {
  const data = await apiGet<AlertsSummary>("/api/reporting/alerts/");
  const totalAlerts =
    data.stock_variance.length + data.unusual_discounts.length + data.missed_visits.length + data.inactive_agents.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Alerts & Exceptions</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Automated exception reporting (AR-11) — stock variance, unusual discounts, missed visits, and prolonged
          agent inactivity. {totalAlerts} open alert{totalAlerts === 1 ? "" : "s"} across all categories.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <SectionHeader
          title="Stock Variance" count={data.stock_variance.length}
          subtitle="Manual stock adjustments in the last 7 days — each one means a physical/expected count didn't match."
          reportKey="stock_variance" csvData={data.stock_variance} csvFilename="stock-variance-alerts.csv"
        />
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              <th className="px-5 py-2 font-medium">Date</th>
              <th className="px-5 py-2 font-medium">Godown</th>
              <th className="px-5 py-2 font-medium">Item</th>
              <th className="px-5 py-2 font-medium">Adjustment Qty</th>
              <th className="px-5 py-2 font-medium">Balance After</th>
            </tr>
          </thead>
          <tbody>
            {data.stock_variance.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-6 text-center text-neutral-400">No stock variance in the last 7 days.</td></tr>
            )}
            {data.stock_variance.map((a) => (
              <tr key={a.entry_id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-5 py-2 text-neutral-700 dark:text-neutral-300">{formatDateTime(a.recorded_at)}</td>
                <td className="px-5 py-2 text-neutral-700 dark:text-neutral-300">{a.godown_name}</td>
                <td className="px-5 py-2 text-neutral-700 dark:text-neutral-300">{a.item_name} ({a.item_sku})</td>
                <td className={`px-5 py-2 font-medium ${a.qty < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {a.qty > 0 ? "+" : ""}{a.qty}
                </td>
                <td className="px-5 py-2 text-neutral-700 dark:text-neutral-300">{a.balance_after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <SectionHeader
          title="Unusual Discounts" count={data.unusual_discounts.length}
          subtitle="Invoices in the last 7 days with a discount of 15% or more of subtotal."
          reportKey="unusual_discounts" csvData={data.unusual_discounts} csvFilename="unusual-discount-alerts.csv"
        />
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              <th className="px-5 py-2 font-medium">Date</th>
              <th className="px-5 py-2 font-medium">Invoice</th>
              <th className="px-5 py-2 font-medium">Customer</th>
              <th className="px-5 py-2 font-medium">Agent</th>
              <th className="px-5 py-2 font-medium">Discount</th>
            </tr>
          </thead>
          <tbody>
            {data.unusual_discounts.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-6 text-center text-neutral-400">No unusual discounts in the last 7 days.</td></tr>
            )}
            {data.unusual_discounts.map((a) => (
              <tr key={a.invoice_id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-5 py-2 text-neutral-700 dark:text-neutral-300">{a.invoice_date}</td>
                <td className="px-5 py-2 font-mono text-xs text-neutral-700 dark:text-neutral-300">{a.invoice_no}</td>
                <td className="px-5 py-2 text-neutral-700 dark:text-neutral-300">{a.customer_name}</td>
                <td className="px-5 py-2 text-neutral-700 dark:text-neutral-300">{a.agent_name}</td>
                <td className="px-5 py-2 font-medium text-orange-600 dark:text-orange-400">
                  {a.discount_pct}% (₹{a.discount_total.toLocaleString("en-IN")})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <SectionHeader
          title="Missed Visits" count={data.missed_visits.length}
          subtitle="Today's beat stops with a trip in progress or completed, but no check-in recorded."
          reportKey="missed_visits" csvData={data.missed_visits} csvFilename="missed-visit-alerts.csv"
        />
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              <th className="px-5 py-2 font-medium">Beat</th>
              <th className="px-5 py-2 font-medium">Agent</th>
              <th className="px-5 py-2 font-medium">Seq.</th>
              <th className="px-5 py-2 font-medium">Customer</th>
            </tr>
          </thead>
          <tbody>
            {data.missed_visits.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-6 text-center text-neutral-400">No missed visits today.</td></tr>
            )}
            {data.missed_visits.map((a, i) => (
              <tr key={`${a.trip_id}-${a.customer_name}-${i}`} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-5 py-2 text-neutral-700 dark:text-neutral-300">{a.beat_name}</td>
                <td className="px-5 py-2 text-neutral-700 dark:text-neutral-300">{a.agent_name}</td>
                <td className="px-5 py-2 text-neutral-700 dark:text-neutral-300">{a.visit_sequence}</td>
                <td className="px-5 py-2 text-neutral-700 dark:text-neutral-300">{a.customer_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <SectionHeader
          title="Inactive Agents" count={data.inactive_agents.length}
          subtitle="Field agents with no invoice, trip, or GPS ping in the last 3 days."
          reportKey="inactive_agents" csvData={data.inactive_agents} csvFilename="inactive-agent-alerts.csv"
        />
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              <th className="px-5 py-2 font-medium">Agent</th>
              <th className="px-5 py-2 font-medium">Last Activity</th>
              <th className="px-5 py-2 font-medium">Days Inactive</th>
            </tr>
          </thead>
          <tbody>
            {data.inactive_agents.length === 0 && (
              <tr><td colSpan={3} className="px-5 py-6 text-center text-neutral-400">Every field agent has been active in the last 3 days.</td></tr>
            )}
            {data.inactive_agents.map((a) => (
              <tr key={a.agent_id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-5 py-2 text-neutral-700 dark:text-neutral-300">{a.agent_name}</td>
                <td className="px-5 py-2 text-neutral-700 dark:text-neutral-300">
                  {a.last_activity_at ? formatDateTime(a.last_activity_at) : "Never"}
                </td>
                <td className="px-5 py-2 font-medium text-red-600 dark:text-red-400">
                  {a.days_inactive === null ? "—" : a.days_inactive}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
