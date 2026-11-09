"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  buildPresets, describeRange, matchPreset, validateRange,
  type DateContext, type DateRange,
} from "@/lib/dateRange";

/**
 * Shared From–To date picker for dated list pages and Reports. State
 * lives in the URL (`?from=YYYY-MM-DD&to=YYYY-MM-DD`) so a filtered view
 * is shareable/bookmarkable and survives reloads; the server page reads
 * it back and passes it to the API. Changing the range drops `page`.
 *
 * Presets are computed from the backend's tenant-local "today" and FY
 * start month (see lib/dateContext.ts), never the browser clock.
 */
export default function DateRangeFilter({
  value,
  context,
  query = {},
  error,
  label = "Date",
}: {
  /** The range currently applied (already validated server-side). */
  value: DateRange;
  context: DateContext;
  /** Other query params on the page to keep when the range changes. */
  query?: Record<string, string | undefined>;
  /** Server-side validation error for the URL's range, if any. */
  error?: string | null;
  /** What the range filters on, e.g. "Order date". */
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const presets = buildPresets(context.today, context.fy_start_month);
  const [from, setFrom] = useState(value.from ?? "");
  const [to, setTo] = useState(value.to ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  const active = matchPreset(value, presets);
  const selectValue = active ? active.key : value.from || value.to ? "custom" : "all";

  function navigate(next: DateRange) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v && k !== "from" && k !== "to" && k !== "page") params.set(k, v);
    }
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  function onPreset(key: string) {
    setLocalError(null);
    if (key === "all") {
      setFrom("");
      setTo("");
      navigate({});
      return;
    }
    const preset = presets.find((p) => p.key === key);
    if (!preset) return; // "custom": just edit the inputs
    setFrom(preset.from);
    setTo(preset.to);
    navigate({ from: preset.from, to: preset.to });
  }

  function onApply(event: React.FormEvent) {
    event.preventDefault();
    const next = { from: from || undefined, to: to || undefined };
    const problem = validateRange(next, context.max_span_days);
    setLocalError(problem);
    if (!problem) navigate(next);
  }

  const shownError = localError || error;
  const inputClass =
    "w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100 sm:w-40";

  return (
    <form
      onSubmit={onApply}
      aria-label={`${label} range filter`}
      className="flex flex-col gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {label}
        <select
          value={selectValue}
          onChange={(e) => onPreset(e.target.value)}
          className={`${inputClass} sm:w-48`}
        >
          <option value="all">All dates</option>
          {presets.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
          <option value="custom">Custom range</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        From
        <input
          type="date"
          name="from"
          value={from}
          max={to || undefined}
          onChange={(e) => setFrom(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        To
        <input
          type="date"
          name="to"
          value={to}
          min={from || undefined}
          onChange={(e) => setTo(e.target.value)}
          className={inputClass}
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-amber-500 disabled:opacity-60"
        >
          Apply
        </button>
        {(value.from || value.to) && (
          <button
            type="button"
            onClick={() => onPreset("all")}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            Clear
          </button>
        )}
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 sm:ml-auto sm:self-center" aria-live="polite">
        {pending ? "Loading…" : describeRange(value)}
      </p>
      {shownError && (
        <p role="alert" className="w-full text-xs text-red-600 dark:text-red-400">
          {shownError}
          {error && !localError ? " The date filter was ignored." : ""}
        </p>
      )}
    </form>
  );
}
