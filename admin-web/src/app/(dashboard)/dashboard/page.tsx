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

type DiscountPatternAlert = {
  agent_id: string;
  agent_name: string;
  invoice_count: number;
  avg_discount_pct: number;
  fleet_avg_discount_pct: number;
  ratio_to_fleet_avg: number;
};

type ReturnFrequencyAlert = {
  agent_id: string;
  agent_name: string;
  invoice_count: number;
  sellable_return_count: number;
  sellable_return_ratio: number;
};

type SpoofedCheckinAlert = {
  checkpoint_id: string;
  trip_id: string;
  agent_name: string;
  customer_id: string;
  customer_name: string;
  check_in_time: string;
  distance_km: number;
};

type ImpossibleTravelAlert = {
  agent_id: string;
  agent_name: string;
  from_time: string;
  to_time: string;
  distance_km: number;
  elapsed_minutes: number;
  implied_speed_kmh: number;
};

type FraudAlertsData = {
  discount_patterns: DiscountPatternAlert[];
  return_frequency: ReturnFrequencyAlert[];
  spoofed_checkins: SpoofedCheckinAlert[];
  impossible_travel: ImpossibleTravelAlert[];
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
        ? "text-orange-600 dark:text-orange-400"
        : "text-neutral-900 dark:text-neutral-50";
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    pending_review: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    overridden: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    synced: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    pending: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
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
      : "border-orange-300 bg-orange-50 dark:border-orange-900/60 dark:bg-orange-950/30";
  const badgeClass =
    insight.severity === "high"
      ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
      : "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{insight.label}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${badgeClass}`}>
          {insight.severity} {insight.direction}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-300">{insight.explanation}</p>
      <p className="mt-1.5 text-xs text-neutral-400 dark:text-neutral-500">
        z-score {insight.z_score > 0 ? "+" : ""}
        {insight.z_score} · baseline {insight.unit}
        {insight.baseline_mean.toLocaleString("en-IN")} ± {insight.unit}
        {insight.baseline_stdev.toLocaleString("en-IN")}
      </p>
    </div>
  );
}

function FraudAlertGroup({
  title, count, description, empty, children,
}: {
  title: string; count: number; description: string; empty: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-white dark:bg-neutral-900 p-4">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
        {title} {count > 0 && `(${count})`}
      </h3>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{description}</p>
      {count === 0 ? (
        <p className="mt-3 text-sm text-neutral-400">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">{children}</ul>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const [data, anomalyData, fraudData] = await Promise.all([
    apiGet<DashboardData>("/api/reporting/dashboard/"),
    apiGet<{ insights: AnomalyInsight[] }>("/api/reporting/anomaly-insights/"),
    apiGet<FraudAlertsData>("/api/reporting/fraud-alerts/"),
  ]);
  const insights = anomalyData.insights;
  const fraudAlertCount =
    fraudData.discount_patterns.length + fraudData.return_frequency.length +
    fraudData.spoofed_checkins.length + fraudData.impossible_travel.length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Live Dashboard</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{data.date}</p>
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
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            Anomaly Insights {insights.length > 0 && `(${insights.length})`}
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Today&apos;s headline metrics compared against their own recent history — flagged only when the
            deviation is a real statistical outlier (§20.1).
          </p>
        </div>
        {insights.length === 0 ? (
          <p className="text-sm text-neutral-400">No anomalies detected today.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {insights.map((insight) => (
              <InsightCard key={insight.metric} insight={insight} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            Fraud &amp; Exception Alerts {fraudAlertCount > 0 && `(${fraudAlertCount})`}
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Patterns across many transactions per agent — a sustained deviation, not a single flagged invoice
            (§20.6).
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FraudAlertGroup
            title="Discount Patterns"
            count={fraudData.discount_patterns.length}
            description="Agents whose average discount% is well above the fleet-wide average."
            empty="No agent discount patterns flagged."
          >
            {fraudData.discount_patterns.map((a) => (
              <li key={a.agent_id} className="rounded-md bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm">
                <p className="font-medium text-neutral-900 dark:text-neutral-50">{a.agent_name}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Avg {a.avg_discount_pct}% vs fleet {a.fleet_avg_discount_pct}% ({a.ratio_to_fleet_avg}x) across{" "}
                  {a.invoice_count} invoices
                </p>
              </li>
            ))}
          </FraudAlertGroup>

          <FraudAlertGroup
            title="Return Frequency"
            count={fraudData.return_frequency.length}
            description="Agents with an unusually high rate of returns claimed fully sellable."
            empty="No unusual return patterns flagged."
          >
            {fraudData.return_frequency.map((a) => (
              <li key={a.agent_id} className="rounded-md bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm">
                <p className="font-medium text-neutral-900 dark:text-neutral-50">{a.agent_name}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {a.sellable_return_count} sellable returns / {a.invoice_count} invoices (
                  {Math.round(a.sellable_return_ratio * 100)}%)
                </p>
              </li>
            ))}
          </FraudAlertGroup>

          <FraudAlertGroup
            title="Spoofed Check-Ins"
            count={fraudData.spoofed_checkins.length}
            description="Outlet check-ins whose GPS lands well outside the customer's registered address."
            empty="No spoofed check-ins flagged."
          >
            {fraudData.spoofed_checkins.map((a) => (
              <li key={a.checkpoint_id} className="rounded-md bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm">
                <p className="font-medium text-neutral-900 dark:text-neutral-50">
                  {a.agent_name} — {a.customer_name}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {a.distance_km} km from registered address at{" "}
                  {new Date(a.check_in_time).toLocaleString("en-IN")}
                </p>
              </li>
            ))}
          </FraudAlertGroup>

          <FraudAlertGroup
            title="Impossible Travel"
            count={fraudData.impossible_travel.length}
            description="Consecutive GPS pings implying a speed no real vehicle could sustain."
            empty="No implausible GPS jumps flagged."
          >
            {fraudData.impossible_travel.map((a, i) => (
              <li key={`${a.agent_id}-${i}`} className="rounded-md bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm">
                <p className="font-medium text-neutral-900 dark:text-neutral-50">{a.agent_name}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {a.distance_km} km in {a.elapsed_minutes} min — implied {a.implied_speed_kmh} km/h
                </p>
              </li>
            ))}
          </FraudAlertGroup>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="border-b border-neutral-200 dark:border-neutral-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Recent Invoices</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
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
                <td colSpan={10} className="px-5 py-6 text-center text-neutral-400">
                  No invoices yet today.
                </td>
              </tr>
            )}
            {data.recent_invoices.map((inv) => (
              <tr key={inv.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-5 py-2 font-mono text-xs text-neutral-700 dark:text-neutral-300">{inv.invoice_no}</td>
                <td className="px-5 py-2 text-neutral-700 dark:text-neutral-300">{inv.customer__name}</td>
                <td className="px-5 py-2 text-neutral-700 dark:text-neutral-300">{inv.agent__username}</td>
                <td className="px-5 py-2 text-neutral-700 dark:text-neutral-300">₹{Number(inv.grand_total).toLocaleString("en-IN")}</td>
                <td className="px-5 py-2"><StatusBadge status={inv.credit_check_status} /></td>
                <td className="px-5 py-2"><StatusBadge status={inv.sync_status} /></td>
                <td className="px-5 py-2">
                  {inv.signature_image ? (
                    <a href={`${API_BASE_URL}/media/${inv.signature_image}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${API_BASE_URL}/media/${inv.signature_image}`}
                        alt="Customer signature"
                        className="h-8 w-14 rounded border border-neutral-200 dark:border-neutral-700 object-contain bg-white"
                      />
                    </a>
                  ) : (
                    <span className="text-xs text-neutral-400">—</span>
                  )}
                </td>
                <td className="px-5 py-2">
                  <a
                    href={`/api/proxy/sales/invoices/${inv.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-500"
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
