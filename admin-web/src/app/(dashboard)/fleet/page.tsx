import { apiGet } from "@/lib/api";
import ExportCsvButton from "@/components/ExportCsvButton";
import DocumentForm from "./DocumentForm";
import GeofenceForm from "./GeofenceForm";

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

type ComplianceAlert = {
  document_id: string;
  holder: string;
  document_type_display: string;
  document_number: string;
  expiry_date: string;
  days_remaining: number;
  status: "due_soon" | "overdue";
};

type GeofenceAlert = {
  trip_id: string;
  agent_name: string;
  vehicle_reg_no: string | null;
  zone_name: string;
  distance_meters: number;
  recorded_at: string;
};

type RouteAnalyticsEntry = {
  trip_id: string;
  agent_name: string;
  vehicle_reg_no: string | null;
  beat_name: string | null;
  start_time: string;
  idle_minutes: number;
  deviation_count: number;
};

type DriverSafetyScore = {
  agent_id: string;
  agent_name: string;
  trip_count: number;
  avg_score: number;
  total_speeding_events: number;
  total_idle_minutes: number;
};

type FleetDashboard = {
  vehicles: VehicleEntry[];
  maintenance_alerts: MaintenanceAlert[];
  fuel_cost_trend: FuelTrendPoint[];
  reverse_logistics: ReverseLogisticsEntry[];
  compliance_alerts: ComplianceAlert[];
  geofence_alerts: GeofenceAlert[];
  route_analytics: RouteAnalyticsEntry[];
  driver_safety_scores: DriverSafetyScore[];
};

type Vehicle = { id: string; reg_no: string };
type User = { id: string; username: string; first_name: string; is_field_agent: boolean };
type Paginated<T> = { count: number; results: T[] };
type Geofence = { id: string; name: string; zone_type: string; radius_meters: number; is_active: boolean };

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
  const [data, vehicles, users, geofences] = await Promise.all([
    apiGet<FleetDashboard>("/api/fleet/dashboard/"),
    apiGet<Paginated<Vehicle>>("/api/fleet/vehicles/"),
    apiGet<Paginated<User>>("/api/users/"),
    apiGet<Paginated<Geofence>>("/api/fleet/geofences/"),
  ]);
  const agents = users.results.filter((u) => u.is_field_agent);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Fleet</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Vehicle utilization, maintenance alerts, fuel cost, reverse-logistics reconciliation, document
          compliance, and geofencing (FM-12/FM-13/FM-14/FM-16).
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

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Document Compliance — RC, insurance, permit, PUC, license ({data.compliance_alerts.length})
          </h2>
          <ExportCsvButton data={data.compliance_alerts} filename="fleet-compliance.csv" />
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-4 py-2 font-medium">Vehicle / Driver</th>
                <th className="px-4 py-2 font-medium">Document</th>
                <th className="px-4 py-2 font-medium">Expiry</th>
                <th className="px-4 py-2 font-medium">Days Remaining</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.compliance_alerts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Nothing due — all documents current.
                  </td>
                </tr>
              )}
              {data.compliance_alerts.map((a) => (
                <tr key={a.document_id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{a.holder}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                    {a.document_type_display}
                    {a.document_number && <span className="ml-1 text-xs text-slate-400">#{a.document_number}</span>}
                  </td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{a.expiry_date}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{a.days_remaining}</td>
                  <td className="px-4 py-2"><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DocumentForm vehicles={vehicles.results} agents={agents} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Geofence Alerts — active trips in a restricted zone ({data.geofence_alerts.length})
          </h2>
          <ExportCsvButton data={data.geofence_alerts} filename="fleet-geofence-alerts.csv" />
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-4 py-2 font-medium">Agent</th>
                <th className="px-4 py-2 font-medium">Vehicle</th>
                <th className="px-4 py-2 font-medium">Zone</th>
                <th className="px-4 py-2 font-medium">Distance</th>
                <th className="px-4 py-2 font-medium">Detected</th>
              </tr>
            </thead>
            <tbody>
              {data.geofence_alerts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    No agents currently inside a restricted zone.
                  </td>
                </tr>
              )}
              {data.geofence_alerts.map((a, i) => (
                <tr key={`${a.trip_id}-${i}`} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{a.agent_name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                    {a.vehicle_reg_no || "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{a.zone_name}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{a.distance_meters} m</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                    {new Date(a.recorded_at).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Zones defined below — mark a zone &quot;Restricted&quot; to have it appear here when an active trip enters it.
        </p>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-4 py-2 font-medium">Zone</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Radius</th>
                <th className="px-4 py-2 font-medium">Active</th>
              </tr>
            </thead>
            <tbody>
              {geofences.results.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    No zones defined yet.
                  </td>
                </tr>
              )}
              {geofences.results.map((g) => (
                <tr key={g.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{g.name}</td>
                  <td className="px-4 py-2 capitalize text-slate-700 dark:text-slate-300">{g.zone_type}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{g.radius_meters} m</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{g.is_active ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <GeofenceForm />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Route Analytics — idle time &amp; route deviation, last 30 days ({data.route_analytics.length})
          </h2>
          <ExportCsvButton data={data.route_analytics} filename="fleet-route-analytics.csv" />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Best-effort from periodic (~3-minute) GPS breadcrumbs, not continuous telemetry — idle time is inferred
          from consecutive pings that stayed in place, and deviation is straight-line distance from the nearest
          planned stop. Only trips with 15+ idle minutes or at least one deviation point are shown.
        </p>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-4 py-2 font-medium">Agent</th>
                <th className="px-4 py-2 font-medium">Vehicle</th>
                <th className="px-4 py-2 font-medium">Beat</th>
                <th className="px-4 py-2 font-medium">Trip Start</th>
                <th className="px-4 py-2 font-medium">Idle</th>
                <th className="px-4 py-2 font-medium">Deviation Points</th>
              </tr>
            </thead>
            <tbody>
              {data.route_analytics.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    No trips with notable idle time or route deviation in the last 30 days.
                  </td>
                </tr>
              )}
              {data.route_analytics.map((r) => (
                <tr key={r.trip_id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{r.agent_name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                    {r.vehicle_reg_no || "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{r.beat_name || "—"}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                    {new Date(r.start_time).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{r.idle_minutes} min</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{r.deviation_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Driver Safety Scores — speeding &amp; idling only, last 30 days ({data.driver_safety_scores.length})
          </h2>
          <ExportCsvButton data={data.driver_safety_scores} filename="driver-safety-scores.csv" />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          100 = nothing flagged. Deducted for GPS-implied speeding segments and for the idle-time share of trip
          duration only — harsh braking/acceleration would need an accelerometer stream this app doesn&apos;t
          collect, so it isn&apos;t part of this score. A coaching starting point, not an automated penalty.
        </p>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-4 py-2 font-medium">Agent</th>
                <th className="px-4 py-2 font-medium">Trips</th>
                <th className="px-4 py-2 font-medium">Avg Score</th>
                <th className="px-4 py-2 font-medium">Speeding Events</th>
                <th className="px-4 py-2 font-medium">Idle Minutes</th>
              </tr>
            </thead>
            <tbody>
              {data.driver_safety_scores.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    No completed trips with GPS breadcrumbs in the last 30 days.
                  </td>
                </tr>
              )}
              {data.driver_safety_scores.map((s) => (
                <tr key={s.agent_id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{s.agent_name}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{s.trip_count}</td>
                  <td
                    className={`px-4 py-2 font-semibold ${
                      s.avg_score < 70
                        ? "text-red-600 dark:text-red-400"
                        : s.avg_score < 90
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {s.avg_score}
                  </td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{s.total_speeding_events}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{s.total_idle_minutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
