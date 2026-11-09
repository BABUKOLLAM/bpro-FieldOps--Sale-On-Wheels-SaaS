/**
 * From–To date-range helpers shared by every dated list page and the
 * Reports page. Pure functions on "YYYY-MM-DD" strings (no Date-in-local-
 * timezone arithmetic), so the result never depends on the timezone of
 * the browser or of the admin-web server — "today" comes from the
 * backend's /api/reporting/date-context/ (the tenant-local day, Asia/
 * Kolkata by default) and everything else is calendar math on it.
 *
 * Contract mirrors backend apps/core/date_range.py: strict YYYY-MM-DD,
 * both bounds inclusive, from <= to, span capped (366 days by default).
 * URL state is `?from=YYYY-MM-DD&to=YYYY-MM-DD`; list APIs take
 * date_from/date_to, report exports take period_start/period_end.
 *
 * Keep this file free of imports so the unit tests (unit/dateRange.spec.ts)
 * can load it directly.
 */

export type DateRange = { from?: string; to?: string };

export type DateContext = {
  today: string;
  timezone: string;
  fy_start_month: number;
  max_span_days: number;
};

export type Preset = { key: string; label: string; from: string; to: string };

export const DEFAULT_MAX_SPAN_DAYS = 366;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Strict YYYY-MM-DD that is also a real calendar date (no 2026-02-30). */
export function isIsoDate(value: string | undefined | null): value is string {
  if (!value || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toUtc(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(value: string, days: number): string {
  const dt = toUtc(value);
  dt.setUTCDate(dt.getUTCDate() + days);
  return fromUtc(dt);
}

/** Inclusive day count: same day = 1. */
export function spanDays(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000) + 1;
}

function ymd(y: number, m: number, d: number): string {
  // m is 1-based and may overflow/underflow; Date.UTC normalises it.
  return fromUtc(new Date(Date.UTC(y, m - 1, d)));
}

function lastDayOfMonth(y: number, m: number): string {
  return ymd(y, m + 1, 0);
}

/** Start of the financial year containing `today` (Indian FY = April). */
export function fyStart(today: string, fyStartMonth: number): string {
  const [y, m] = today.split("-").map(Number);
  const startYear = m >= fyStartMonth ? y : y - 1;
  return ymd(startYear, fyStartMonth, 1);
}

/** FY-aligned quarter containing `today` (Apr–Jun, Jul–Sep, … for April). */
export function quarterBounds(today: string, fyStartMonth: number): { from: string; to: string } {
  const [y, m] = today.split("-").map(Number);
  const monthsIntoFy = (m - fyStartMonth + 12) % 12;
  const quarterStartMonth = m - (monthsIntoFy % 3);
  const from = ymd(y, quarterStartMonth, 1);
  const [fy, fm] = from.split("-").map(Number);
  return { from, to: lastDayOfMonth(fy, fm + 2) };
}

export function buildPresets(today: string, fyStartMonth = 4): Preset[] {
  const [y, m] = today.split("-").map(Number);
  // ISO week, Monday first (the norm for Indian business reporting).
  const weekday = (toUtc(today).getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const quarter = quarterBounds(today, fyStartMonth);
  return [
    { key: "today", label: "Today", from: today, to: today },
    { key: "yesterday", label: "Yesterday", from: addDays(today, -1), to: addDays(today, -1) },
    { key: "this_week", label: "This week", from: addDays(today, -weekday), to: today },
    { key: "last_7", label: "Last 7 days", from: addDays(today, -6), to: today },
    { key: "mtd", label: "This month to date", from: ymd(y, m, 1), to: today },
    { key: "last_month", label: "Last month", from: ymd(y, m - 1, 1), to: lastDayOfMonth(y, m - 1) },
    { key: "last_30", label: "Last 30 days", from: addDays(today, -29), to: today },
    { key: "this_quarter", label: "This quarter", from: quarter.from, to: quarter.to },
    { key: "fytd", label: "This FY to date", from: fyStart(today, fyStartMonth), to: today },
  ];
}

export function matchPreset(range: DateRange, presets: Preset[]): Preset | undefined {
  return presets.find((p) => p.from === range.from && p.to === range.to);
}

/** Returns an error message, or null when the range is acceptable.
 * An empty range (no bounds) is valid and means "all dates". */
export function validateRange(range: DateRange, maxSpanDays = DEFAULT_MAX_SPAN_DAYS): string | null {
  if (range.from && !isIsoDate(range.from)) return "From date must be a real date in YYYY-MM-DD.";
  if (range.to && !isIsoDate(range.to)) return "To date must be a real date in YYYY-MM-DD.";
  if (range.from && range.to) {
    if (range.from > range.to) return "From date must be on or before To date.";
    const span = spanDays(range.from, range.to);
    if (span > maxSpanDays) return `Range is ${span} days; the maximum is ${maxSpanDays} days.`;
  }
  return null;
}

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v ? v.trim() : undefined;
}

/** Read `?from=&to=` from a page's searchParams. An invalid range is
 * dropped (not sent to the API) and reported back as `error`. */
export function readRange(
  params: RawParams,
  maxSpanDays = DEFAULT_MAX_SPAN_DAYS,
): { range: DateRange; error: string | null; raw: DateRange } {
  const raw = { from: first(params.from), to: first(params.to) };
  const error = validateRange(raw, maxSpanDays);
  return { range: error ? {} : raw, error, raw };
}

export function readPage(params: RawParams): number {
  const n = Number(first(params.page));
  return Number.isInteger(n) && n > 1 ? n : 1;
}

/** Query string fragment for list APIs (date_from/date_to), prefixed
 * with `&` when non-empty so it can be appended to an existing query. */
export function apiRangeQuery(range: DateRange, keys: [string, string] = ["date_from", "date_to"]): string {
  const parts: string[] = [];
  if (range.from) parts.push(`${keys[0]}=${range.from}`);
  if (range.to) parts.push(`${keys[1]}=${range.to}`);
  return parts.length ? `&${parts.join("&")}` : "";
}

/** Human label, e.g. "1 Nov 2026 – 9 Nov 2026 (9 days)". */
export function describeRange(range: DateRange): string {
  const fmt = (v: string) => {
    const [y, m, d] = v.split("-").map(Number);
    const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
    return `${d} ${month} ${y}`;
  };
  if (range.from && range.to) {
    const days = spanDays(range.from, range.to);
    return `${fmt(range.from)} – ${fmt(range.to)} (${days} day${days === 1 ? "" : "s"})`;
  }
  if (range.from) return `From ${fmt(range.from)}`;
  if (range.to) return `Up to ${fmt(range.to)}`;
  return "All dates";
}

/** "orders.csv" -> "orders_2026-11-01_to_2026-11-09.csv" when a range is
 * set, plus "_this-page" when the list has more pages than the one being
 * exported — so the file name never claims the whole period. */
export function rangedFilename(filename: string, range: DateRange, opts: { thisPage?: boolean } = {}): string {
  const dot = filename.lastIndexOf(".");
  const ext = dot > 0 ? filename.slice(dot) : "";
  let base = dot > 0 ? filename.slice(0, dot) : filename;
  if (range.from || range.to) base = `${base}_${range.from ?? "start"}_to_${range.to ?? "now"}`;
  if (opts.thisPage) base = `${base}_this-page`;
  return `${base}${ext}`;
}

/** Tenant-local "today" fallback when the backend's date context is
 * unavailable: the calendar day in `timeZone` (India by default). */
export function todayIn(timeZone = "Asia/Kolkata", now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
