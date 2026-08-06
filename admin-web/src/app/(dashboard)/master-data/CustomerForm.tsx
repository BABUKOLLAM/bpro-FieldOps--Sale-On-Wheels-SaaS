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
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Code</label>
        <input required value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 w-32 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Name</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-56 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Credit Limit</label>
        <input type="number" min="0" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} className="mt-1 w-32 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100" />
      </div>
      <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
        {submitting ? "Adding…" : "Add Customer"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
