"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BeatTemplateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/proxy/customers/beat-templates", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(JSON.stringify(data));
      }
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template.");
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
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Trip plan template name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Weekly North Route"
          className="mt-1 w-64 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-amber-500 disabled:opacity-60"
      >
        {submitting ? "Adding…" : "Add Template"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
