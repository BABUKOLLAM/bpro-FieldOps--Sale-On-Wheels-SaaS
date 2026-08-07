import { apiGet } from "@/lib/api";
import LiveMapLoader from "./LiveMapLoader";

type Stop = {
  customer_id: string;
  customer_name: string;
  visit_sequence: number;
  latitude: number | null;
  longitude: number | null;
  status: "visited" | "pending";
};

type AgentEntry = {
  agent_id: string;
  agent_name: string;
  trip_id: string;
  trip_status: string;
  vehicle_reg_no: string | null;
  last_location: { latitude: number; longitude: number; recorded_at: string } | null;
  beat_name: string | null;
  stops: Stop[];
};

type LiveMapResponse = { agents: AgentEntry[] };

export default async function LiveMapPage() {
  const data = await apiGet<LiveMapResponse>("/api/reporting/live-map/");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Live Map</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Real-time agent locations and route adherence (AR-03) — {data.agents.length} agent
          {data.agents.length === 1 ? "" : "s"} currently on a trip.
        </p>
      </div>

      {data.agents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-400">
          No agents are on an active trip right now. The map will populate as soon as a trip starts and location pings arrive.
        </div>
      ) : (
        <LiveMapLoader agents={data.agents} />
      )}

      <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Agent (last known location)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Outlet visited
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Outlet pending
        </span>
      </div>
    </div>
  );
}
