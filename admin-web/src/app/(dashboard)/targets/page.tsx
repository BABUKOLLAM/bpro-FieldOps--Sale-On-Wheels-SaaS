import { apiGet } from "@/lib/api";
import TargetForm from "./TargetForm";

type Paginated<T> = { count: number; results: T[] };

type Target = {
  id: string;
  agent: string;
  beat: string | null;
  metric: "sales" | "collections";
  period_start: string;
  period_end: string;
  target_amount: string;
  achieved_amount: string;
};

type User = { id: string; username: string; first_name: string; is_field_agent: boolean };
type Beat = { id: string; name: string };

function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default async function TargetsPage() {
  const [targets, users, beats] = await Promise.all([
    apiGet<Paginated<Target>>("/api/reporting/targets/"),
    apiGet<Paginated<User>>("/api/users/"),
    apiGet<Paginated<Beat>>("/api/customers/beats/"),
  ]);
  const agents = users.results.filter((u) => u.is_field_agent);
  const agentById = new Map(users.results.map((u) => [u.id, u]));
  const beatById = new Map(beats.results.map((b) => [b.id, b]));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Targets</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Set sales/collection targets per agent and route, and track achievement in real time (AR-07).
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Active Targets ({targets.count})
        </h2>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-4 py-2 font-medium">Agent</th>
                <th className="px-4 py-2 font-medium">Route</th>
                <th className="px-4 py-2 font-medium">Metric</th>
                <th className="px-4 py-2 font-medium">Period</th>
                <th className="px-4 py-2 font-medium">Target</th>
                <th className="px-4 py-2 font-medium">Achieved</th>
                <th className="px-4 py-2 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody>
              {targets.results.map((t) => {
                const target = Number(t.target_amount);
                const achieved = Number(t.achieved_amount);
                const pct = target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0;
                const agent = agentById.get(t.agent);
                const beat = t.beat ? beatById.get(t.beat) : null;
                return (
                  <tr key={t.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                      {agent ? agent.first_name || agent.username : "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{beat ? beat.name : "Any route"}</td>
                    <td className="px-4 py-2 capitalize text-slate-700 dark:text-slate-300">{t.metric}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                      {t.period_start} → {t.period_end}
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{formatINR(target)}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{formatINR(achieved)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-indigo-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {targets.results.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                    No targets set yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TargetForm agents={agents} beats={beats.results} />
      </section>
    </div>
  );
}
