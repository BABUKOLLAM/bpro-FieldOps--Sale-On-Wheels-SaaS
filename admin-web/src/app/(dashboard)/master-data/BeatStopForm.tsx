"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Customer = { id: string; code: string; name: string };

export default function BeatStopForm({ beatId, customers }: { beatId: string; customers: Customer[] }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [visitSequence, setVisitSequence] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!customerId) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/proxy/customers/beat-stops", {
        method: "POST",
        body: JSON.stringify({ beat: beatId, customer: customerId, visit_sequence: Number(visitSequence) }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(JSON.stringify(data));
      }
      setCustomerId("");
      setVisitSequence("1");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add stop.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <select
        required
        value={customerId}
        onChange={(e) => setCustomerId(e.target.value)}
        className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1 text-xs text-neutral-900 dark:text-neutral-100"
      >
        <option value="">Add outlet…</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code} — {c.name}
          </option>
        ))}
      </select>
      <input
        type="number"
        min="1"
        value={visitSequence}
        onChange={(e) => setVisitSequence(e.target.value)}
        title="Visit sequence"
        className="w-14 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1 text-xs text-neutral-900 dark:text-neutral-100"
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-neutral-100 dark:bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-900 dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-60"
      >
        {submitting ? "Adding…" : "Add stop"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
