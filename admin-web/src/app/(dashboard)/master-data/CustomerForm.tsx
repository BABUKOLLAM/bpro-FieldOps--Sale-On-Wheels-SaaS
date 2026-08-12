"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CustomerForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [creditLimit, setCreditLimit] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/proxy/customers/customers", {
        method: "POST",
        body: JSON.stringify({ code, name, credit_limit: creditLimit, credit_days: 15 }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(JSON.stringify(data));
      }
      setCode("");
      setName("");
      setCreditLimit("0");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create customer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-4">
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Code</label>
        <input required value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 w-32 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100" />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Name</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-56 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100" />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Credit Limit</label>
        <input type="number" min="0" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} className="mt-1 w-32 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100" />
      </div>
      <button type="submit" disabled={submitting} className="rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-amber-500 disabled:opacity-60">
        {submitting ? "Adding…" : "Add Customer"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
