"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Agent = { id: string; username: string; first_name: string };
type Beat = { id: string; name: string };

export default function TargetForm({ agents, beats }: { agents: Agent[]; beats: Beat[] }) {
  const router = useRouter();
  const [agentId, setAgentId] = useState("");
  const [beatId, setBeatId] = useState("");
  const [metric, setMetric] = useState<"sales" | "collections">("sales");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/proxy/reporting/targets", {
        method: "POST",
        body: JSON.stringify({
          agent: agentId,
          beat: beatId || null,
          metric,
          period_start: periodStart,
          period_end: periodEnd,
          target_amount: targetAmount,
        }),
      });
      if (!response.ok) throw new Error(JSON.stringify(await response.json().catch(() => ({}))));
      setAgentId("");
      setBeatId("");
      setPeriodStart("");
      setPeriodEnd("");
      setTargetAmount("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create target.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-4"
    >
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Agent</label>
        <select
          required
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          className="mt-1 w-48 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
        >
          <option value="">Select agent</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.first_name || a.username}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Route (optional)</label>
        <select
          value={beatId}
          onChange={(e) => setBeatId(e.target.value)}
          className="mt-1 w-40 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
        >
          <option value="">Any route</option>
          {beats.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Metric</label>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value as "sales" | "collections")}
          className="mt-1 w-32 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
        >
          <option value="sales">Sales</option>
          <option value="collections">Collections</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Period start</label>
        <input
          required
          type="date"
          value={periodStart}
          onChange={(e) => setPeriodStart(e.target.value)}
          className="mt-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Period end</label>
        <input
          required
          type="date"
          value={periodEnd}
          onChange={(e) => setPeriodEnd(e.target.value)}
          className="mt-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Target amount (₹)</label>
        <input
          required
          type="number"
          min="0"
          value={targetAmount}
          onChange={(e) => setTargetAmount(e.target.value)}
          className="mt-1 w-32 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-amber-500 disabled:opacity-60"
      >
        {submitting ? "Adding…" : "Set Target"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
