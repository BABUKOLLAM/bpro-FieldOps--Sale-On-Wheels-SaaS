"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Agent = { id: string; username: string; first_name: string };

export default function InstantiateTemplateForm({ templateId, agents }: { templateId: string; agents: Agent[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBeatName, setCreatedBeatName] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setCreatedBeatName(null);
    try {
      const response = await fetch(`/api/proxy/customers/beat-templates/${templateId}/instantiate`, {
        method: "POST",
        body: JSON.stringify({ name: name || undefined, assigned_agent: agentId || undefined }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(JSON.stringify(data));
      }
      const beat = await response.json();
      setCreatedBeatName(beat.name);
      setName("");
      setAgentId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create a route from this template.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New route name (optional)"
        className="w-48 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs text-slate-900 dark:text-slate-100"
      />
      <select
        value={agentId}
        onChange={(e) => setAgentId(e.target.value)}
        className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs text-slate-900 dark:text-slate-100"
      >
        <option value="">Unassigned</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.first_name || a.username}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
      >
        {submitting ? "Creating…" : "Instantiate as new route"}
      </button>
      {createdBeatName && <span className="text-xs text-emerald-600">Created "{createdBeatName}" — see Routes above.</span>}
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
