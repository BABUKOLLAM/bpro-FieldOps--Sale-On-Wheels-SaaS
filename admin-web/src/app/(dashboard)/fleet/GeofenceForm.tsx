"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GeofenceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [zoneType, setZoneType] = useState("restricted");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("200");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/proxy/fleet/geofences", {
        method: "POST",
        body: JSON.stringify({
          name,
          zone_type: zoneType,
          latitude,
          longitude,
          radius_meters: Number(radius) || 200,
        }),
      });
      if (!response.ok) throw new Error(JSON.stringify(await response.json().catch(() => ({}))));
      setName("");
      setLatitude("");
      setLongitude("");
      setRadius("200");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add geofence.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-4"
    >
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Zone name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-40 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Type</label>
        <select
          value={zoneType}
          onChange={(e) => setZoneType(e.target.value)}
          className="mt-1 w-32 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
        >
          <option value="warehouse">Warehouse</option>
          <option value="depot">Depot</option>
          <option value="restricted">Restricted</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Latitude</label>
        <input
          required
          value={latitude}
          onChange={(e) => setLatitude(e.target.value)}
          placeholder="19.076000"
          className="mt-1 w-28 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Longitude</label>
        <input
          required
          value={longitude}
          onChange={(e) => setLongitude(e.target.value)}
          placeholder="72.877700"
          className="mt-1 w-28 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Radius (m)</label>
        <input
          type="number"
          min="10"
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          className="mt-1 w-24 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
      >
        {submitting ? "Adding…" : "Add Zone"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
