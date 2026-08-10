"use client";

import { useEffect, useState } from "react";

type EwayBill = {
  status: string;
  vehicle_no: string;
  valid_until: string | null;
};

export default function EwayBillCell({ invoiceId }: { invoiceId: string }) {
  const [ewb, setEwb] = useState<EwayBill | null | undefined>(undefined); // undefined = loading
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [vehicleNo, setVehicleNo] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/proxy/sales/invoices/${invoiceId}/eway-bill`)
      .then((r) => (r.status === 404 ? null : r.json()))
      .then((data) => {
        if (!cancelled) setEwb(data);
      })
      .catch(() => {
        if (!cancelled) setEwb(null);
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  async function handleGenerate(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/proxy/sales/invoices/${invoiceId}/eway-bill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle_no: vehicleNo, distance_km: Number(distanceKm) || 0 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not generate e-way bill.");
      setEwb(data);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate e-way bill.");
    } finally {
      setSubmitting(false);
    }
  }

  if (ewb === undefined) {
    return <span className="text-xs text-slate-400">…</span>;
  }

  if (ewb) {
    return (
      <div className="text-xs">
        <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
          draft
        </span>
        <a
          href={`/api/proxy/sales/invoices/${invoiceId}/eway-bill-pdf`}
          target="_blank"
          rel="noreferrer"
          className="ml-2 font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
        >
          Download
        </a>
      </div>
    );
  }

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
      >
        Generate
      </button>
    );
  }

  return (
    <form onSubmit={handleGenerate} className="flex flex-col gap-1">
      <input
        type="text"
        placeholder="Vehicle no."
        value={vehicleNo}
        onChange={(e) => setVehicleNo(e.target.value)}
        required
        className="w-24 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-1.5 py-0.5 text-xs text-slate-900 dark:text-slate-100"
      />
      <input
        type="number"
        min={0}
        placeholder="Distance (km)"
        value={distanceKm}
        onChange={(e) => setDistanceKm(e.target.value)}
        className="w-24 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-1.5 py-0.5 text-xs text-slate-900 dark:text-slate-100"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {submitting ? "…" : "Save"}
        </button>
        <button type="button" onClick={() => setShowForm(false)} className="text-xs text-slate-400 hover:text-slate-600">
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
