import { apiGet } from "@/lib/api";
import ExportCsvButton from "@/components/ExportCsvButton";

type VehicleEntry = {
  vehicle_id: string;
  reg_no: string;
  assigned_agent_name: string | null;
  trip_count_30d: number;
  distance_km_30d: number;
  fuel_cost_30d: number;
  avg_efficiency_kmpl: number | null;
  maintenance_status: "ok" | "due_soon" | "overdue";
};

type MaintenanceAlert = {
  schedule_id: string;
  vehicle_reg_no: string;
  description: string;
  next_due_date: string | null;
  next_due_odometer: number | null;
  current_odometer: number | null;
  status: "due_soon" | "overdue";
};

type FuelTrendPoint = { month: string; total_cost: number };

type ReverseLogisticsEntry = {
  credit_note_id: string;
  credit_note_no: string;
  agent_name: string;
  item_name: string;
  qty: number;
  condition: string;
  date: string;
  reconciled: boolean;
};

type FleetDashboard = {
  vehicles: VehicleEntry[];
  maintenance_alerts: MaintenanceAlert[];
  fuel_cost_trend: FuelTrendPoint[];
  reverse_logistics: ReverseLogisticsEntry[];
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    due_soon: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    overdue: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || styles.ok}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export default async function FleetPage() {
  const data = await apiGet<FleetDashboard>("/api/fleet/dashboard/");

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Fleet</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Vehicle utilization, maintenance alerts, fuel cost, and reverse-logistics reconciliation (FM-12/FM-13).
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Vehicle Utilization — last 30 days ({data.vehicles.length})
          </h2>
          <ExportCsvButton data={data.vehicles} filename="fleet-vehicle-utilization.csv" />
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-4 py-2 font-medium">Vehicle</th>
                <th className="px-4 py-2 font-medium">Agent</th>
                <th className="px-4 py-2 font-medium">Trips</th>
                <th className="px-4 py-2 font-medium">Distance</th>
                <th className="px-4 py-2 font-medium">Fuel Cost</th>
                <th className="px-4 py-2 font-medium">Efficiency</th>
                <th className="px-4 py-2 font-medium">Maintenance</th>
              </tr>
            </thead>
            <tbody>
              {data.vehicles.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                    No active vehicles.
                  </td>
                </tr>
              )}
              {data.vehicles.map((v) => (
                <tr key={v.vehicle_id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">{v.reg_no}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{v.assigned_agent_name || "—"}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{v.trip_count_30d}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{Number(v.distance_km_30d).toFixed(0)} km</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">₹{Number(v.fuel_cost_30d).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                    {v.avg_efficiency_kmpl != null ? `${Number(v.avg_efficiency_kmpl).toFixed(1)} km/l` : "—"}
                  </td>
                  <td className="px-4 py-2"><StatusBadge status={v.maintenance_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Maintenance Alerts ({data.maintenance_alerts.length})
          </h2>
          <ExportCsvButton data={data.maintenance_alerts} filename="fleet-maintenance-alerts.csv" />
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-4 py-2 font-medium">Vehicle</th>
                <th className="px-4 py-2 font-medium">Item</th>
                <th className="px-4 py-2 font-medium">Due Date</th>
                <th className="px-4 py-2 font-medium">Due Odometer</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.maintenance_alerts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Nothing due — all schedules on track.
                  </td>
                </tr>
              )}
              {data.maintenance_alerts.map((a) => (
                <tr key={a.schedule_id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">{a.vehicle_reg_no}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{a.description}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{a.next_due_date || "—"}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                    {a.next_due_odometer != null ? `${a.next_due_odometer} km` : "—"}
                  </td>
                  <td className="px-4 py-2"><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Fuel Cost Trend — last 6 months</h2>
          <ExportCsvButton data={data.fuel_cost_trend} filename="fleet-fuel-cost-trend.csv" />
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          {data.fuel_cost_trend.length === 0 ? (
            <p className="text-sm text-slate-400">No fuel logs in this period.</p>
          ) : (
            <div className="flex items-end gap-3" style={{ height: 140 }}>
              {(() => {
                const max = Math.max(...data.fuel_cost_trend.map((p) => Number(p.total_cost)), 1);
                return data.fuel_cost_trend.map((p) => (
                  <div key={p.month} className="flex flex-1 flex-col items-center gap-1.5">
                    <div
                      className="w-full rounded-t bg-indigo-600"
                      style={{ height: `${Math.max(4, (Number(p.total_cost) / max) * 110)}px` }}
                      title={`₹${Number(p.total_cost).toLocaleString("en-IN")}`}
                    />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{p.month}</span>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Reverse Logistics — damaged/expired returns, last 30 days ({data.reverse_logistics.length})
          </h2>
          <ExportCsvButton data={data.reverse_logistics} filename="fleet-reverse-logistics.csv" />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          &quot;Reconciled&quot; means a van-unload stock transfer exists for that agent on that date — a proxy
          signal that the item has physically been returned to the warehouse, not a guarantee.
        </p>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-4 py-2 font-medium">Credit Note</th>
                <th className="px-4 py-2 font-medium">Agent</th>
                <th className="px-4 py-2 font-medium">Item</th>
                <th className="px-4 py-2 font-medium">Qty</th>
                <th className="px-4 py-2 font-medium">Condition</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Reconciled</th>
              </tr>
            </thead>
            <tbody>
              {data.reverse_logistics.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                    No damaged/expired returns in this period.
                  </td>
                </tr>
              )}
              {data.reverse_logistics.map((r, i) => (
                <tr key={`${r.credit_note_id}-${i}`} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                    {r.credit_note_no || r.credit_note_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{r.agent_name}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{r.item_name}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{r.qty}</td>
                  <td className="px-4 py-2 capitalize text-slate-700 dark:text-slate-300">{r.condition}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{r.date}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={r.reconciled ? "ok" : "due_soon"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
