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
    return <span className="text-xs text-neutral-400">…</span>;
  }

  if (ewb) {
    return (
      <div className="text-xs">
        <span className="inline-block rounded-full bg-orange-100 px-2 py-0.5 font-medium text-orange-800 dark:bg-orange-900/40 dark:text-orange-300">
          draft
        </span>
        <a
          href={`/api/proxy/sales/invoices/${invoiceId}/eway-bill-pdf`}
          target="_blank"
          rel="noreferrer"
          className="ml-2 font-medium text-amber-600 dark:text-amber-400 hover:text-amber-500"
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
        className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-500"
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
        className="w-24 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-1.5 py-0.5 text-xs text-neutral-900 dark:text-neutral-100"
      />
      <input
        type="number"
        min={0}
        placeholder="Distance (km)"
        value={distanceKm}
        onChange={(e) => setDistanceKm(e.target.value)}
        className="w-24 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-1.5 py-0.5 text-xs text-neutral-900 dark:text-neutral-100"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-amber-600 px-2 py-0.5 text-xs font-medium text-neutral-950 hover:bg-amber-500 disabled:opacity-60"
        >
          {submitting ? "…" : "Save"}
        </button>
        <button type="button" onClick={() => setShowForm(false)} className="text-xs text-neutral-400 hover:text-neutral-600">
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
