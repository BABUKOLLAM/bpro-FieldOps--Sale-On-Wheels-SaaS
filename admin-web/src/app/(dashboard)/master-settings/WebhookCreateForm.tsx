"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EVENT_TYPES = ["invoice.finalized", "receipt.finalized", "credit_note.finalized"];

export default function WebhookCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [events, setEvents] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleEvent(event: string) {
    setEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      return next;
    });
  }

  async function handleCreate() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/proxy/integrations/webhooks", {
        method: "POST",
        body: JSON.stringify({ name, url, secret, event_types: Array.from(events) }),
      });
      if (!response.ok) throw new Error(JSON.stringify(await response.json().catch(() => ({}))));
      setName("");
      setUrl("");
      setSecret("");
      setEvents(new Set());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create webhook.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-4 space-y-3">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        New subscriptions are added directly — only edits to an existing webhook go through approval.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-50"
          />
        </label>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          URL
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhook"
            className="mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-50"
          />
        </label>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Secret
          <input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Used to sign deliveries"
            className="mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-50"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        {EVENT_TYPES.map((event) => (
          <label key={event} className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
            <input type="checkbox" checked={events.has(event)} onChange={() => toggleEvent(event)} />
            {event}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleCreate}
          disabled={submitting || !name || !url || !secret}
          className="rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-amber-500 disabled:opacity-60"
        >
          {submitting ? "Adding…" : "Add Webhook"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
