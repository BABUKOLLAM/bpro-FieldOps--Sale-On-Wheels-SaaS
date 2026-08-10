import { apiGet } from "@/lib/api";
import EwayBillCell from "./EwayBillCell";
import WhatsAppNotifyButton from "./WhatsAppNotifyButton";

type AnomalyInsight = {
  metric: string;
  label: string;
  today_value: number;
  baseline_mean: number;
  baseline_stdev: number;
  z_score: number;
  direction: "spike" | "drop";
  severity: "medium" | "high";
  unit: string;
  explanation: string;
};

type DashboardData = {
  date: string;
  todays_sales_total: number;
  todays_sales_count: number;
  todays_collections_total: number;
  active_trips_count: number;
  checked_in_today_count: number;
  pending_credit_review_count: number;
  sync_failure_count: number;
  recent_invoices: {
    id: string;
    invoice_no: string;
    customer__name: string;
    agent__username: string;
    grand_total: number;
    credit_check_status: string;
    sync_status: string;
    created_at: string;
    signature_image: string;
  }[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: "warn" | "danger" }) {
  const toneClass =
    tone === "danger"
      ? "text-red-600 dark:text-red-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : "text-slate-900 dark:text-slate-50";
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    pending_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    overridden: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    synced: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    pending: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || styles.pending}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function InsightCard({ insight }: { insight: AnomalyInsight }) {
  const toneClass =
    insight.severity === "high"
      ? "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30"
      : "border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30";
  const badgeClass =
    insight.severity === "high"
      ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
      : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{insight.label}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${badgeClass}`}>
          {insight.severity} {insight.direction}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{insight.explanation}</p>
      <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
        z-score {insight.z_score > 0 ? "+" : ""}
        {insight.z_score} · baseline {insight.unit}
        {insight.baseline_mean.toLocaleString("en-IN")} ± {insight.unit}
        {insight.baseline_stdev.toLocaleString("en-IN")}
      </p>
    </div>
  );
}

export default async function DashboardPage() {
  const [data, anomalyData] = await Promise.all([
    apiGet<DashboardData>("/api/reporting/dashboard/"),
    apiGet<{ insights: AnomalyInsight[] }>("/api/reporting/anomaly-insights/"),
  ]);
  const insights = anomalyData.insights;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Live Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{data.date}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Today's Sales" value={`₹${Number(data.todays_sales_total).toLocaleString("en-IN")}`} />
        <StatCard label="Invoices Today" value={data.todays_sales_count} />
        <StatCard label="Collections Today" value={`₹${Number(data.todays_collections_total).toLocaleString("en-IN")}`} />
        <StatCard label="Active Trips" value={data.active_trips_count} />
        <StatCard label="Checked In Today" value={data.checked_in_today_count} />
        <StatCard label="Pending Credit Review" value={data.pending_credit_review_count} tone={data.pending_credit_review_count > 0 ? "warn" : undefined} />
        <StatCard label="Sync Failures" value={data.sync_failure_count} tone={data.sync_failure_count > 0 ? "danger" : undefined} />
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Anomaly Insights {insights.length > 0 && `(${insights.length})`}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Today&apos;s headline metrics compared against their own recent history — flagged only when the
            deviation is a real statistical outlier (§20.1).
          </p>
        </div>
        {insights.length === 0 ? (
          <p className="text-sm text-slate-400">No anomalies detected today.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {insights.map((insight) => (
              <InsightCard key={insight.metric} insight={insight} />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Recent Invoices</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th className="px-5 py-2 font-medium">Invoice</th>
              <th className="px-5 py-2 font-medium">Customer</th>
              <th className="px-5 py-2 font-medium">Agent</th>
              <th className="px-5 py-2 font-medium">Amount</th>
              <th className="px-5 py-2 font-medium">Credit</th>
              <th className="px-5 py-2 font-medium">Sync</th>
              <th className="px-5 py-2 font-medium">Signature</th>
              <th className="px-5 py-2 font-medium">Invoice PDF</th>
              <th className="px-5 py-2 font-medium">E-way Bill</th>
              <th className="px-5 py-2 font-medium">WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {data.recent_invoices.length === 0 && (
              <tr>
                <td colSpan={10} className="px-5 py-6 text-center text-slate-400">
                  No invoices yet today.
                </td>
              </tr>
            )}
            {data.recent_invoices.map((inv) => (
              <tr key={inv.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-5 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">{inv.invoice_no}</td>
                <td className="px-5 py-2 text-slate-700 dark:text-slate-300">{inv.customer__name}</td>
                <td className="px-5 py-2 text-slate-700 dark:text-slate-300">{inv.agent__username}</td>
                <td className="px-5 py-2 text-slate-700 dark:text-slate-300">₹{Number(inv.grand_total).toLocaleString("en-IN")}</td>
                <td className="px-5 py-2"><StatusBadge status={inv.credit_check_status} /></td>
                <td className="px-5 py-2"><StatusBadge status={inv.sync_status} /></td>
                <td className="px-5 py-2">
                  {inv.signature_image ? (
                    <a href={`${API_BASE_URL}/media/${inv.signature_image}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${API_BASE_URL}/media/${inv.signature_image}`}
                        alt="Customer signature"
                        className="h-8 w-14 rounded border border-slate-200 dark:border-slate-700 object-contain bg-white"
                      />
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-5 py-2">
                  <a
                    href={`/api/proxy/sales/invoices/${inv.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                  >
                    Download
                  </a>
                </td>
                <td className="px-5 py-2">
                  <EwayBillCell invoiceId={inv.id} />
                </td>
                <td className="px-5 py-2">
                  <WhatsAppNotifyButton invoiceId={inv.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
