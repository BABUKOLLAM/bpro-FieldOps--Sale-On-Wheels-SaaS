/**
 * From–To date maths for the "My history" screen. Same contract as the
 * backend's apps/core/date_range.py and admin-web's lib/dateRange.ts:
 * strict YYYY-MM-DD, both days inclusive, from <= to, years 2000–2100,
 * span capped at 366 days.
 *
 * "Today" is the India (IST, UTC+05:30) calendar day, computed from a
 * fixed offset rather than Intl time-zone data — India has no daylight
 * saving, and Hermes' Intl time-zone support varies by platform/version.
 * All other maths is on "YYYY-MM-DD" strings via UTC Date objects, so
 * the phone's own time-zone setting never shifts a day.
 */

export type DateRange = { from: string; to: string };
export type PresetKey =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_7'
  | 'mtd'
  | 'last_month'
  | 'last_30';

export const PRESET_ORDER: PresetKey[] = [
  'today',
  'yesterday',
  'this_week',
  'last_7',
  'mtd',
  'last_month',
  'last_30',
];

export const MAX_SPAN_DAYS = 366;
const IST_OFFSET_MINUTES = 330;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toUtc(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function ymd(y: number, m: number, d: number): string {
  // m is 1-based and may over/underflow; Date.UTC normalises it.
  return fromUtc(new Date(Date.UTC(y, m - 1, d)));
}

/** India calendar day for an instant (default: now). */
export function todayInIndia(now: Date = new Date()): string {
  return fromUtc(new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000));
}

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !ISO_DATE.test(value)) {
    return false;
  }
  const [y, m, d] = value.split('-').map(Number);
  const dt = toUtc(value);
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function addDays(value: string, days: number): string {
  const dt = toUtc(value);
  dt.setUTCDate(dt.getUTCDate() + days);
  return fromUtc(dt);
}

/** Inclusive day count: same day = 1. */
export function spanDays(from: string, to: string): number {
  return (
    Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000) + 1
  );
}

export function presetRange(key: PresetKey, today: string): DateRange {
  const [y, m] = today.split('-').map(Number);
  switch (key) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const d = addDays(today, -1);
      return { from: d, to: d };
    }
    case 'this_week': {
      // Monday-first week, the norm for Indian business reporting.
      const weekday = (toUtc(today).getUTCDay() + 6) % 7;
      return { from: addDays(today, -weekday), to: today };
    }
    case 'last_7':
      return { from: addDays(today, -6), to: today };
    case 'mtd':
      return { from: ymd(y, m, 1), to: today };
    case 'last_month':
      return { from: ymd(y, m - 1, 1), to: ymd(y, m, 0) };
    case 'last_30':
      return { from: addDays(today, -29), to: today };
  }
}

export function matchPreset(range: DateRange, today: string): PresetKey | null {
  for (const key of PRESET_ORDER) {
    const p = presetRange(key, today);
    if (p.from === range.from && p.to === range.to) {
      return key;
    }
  }
  return null;
}

export type RangeError =
  | 'invalid_from'
  | 'invalid_to'
  | 'from_after_to'
  | 'too_long';

/** null when the range is acceptable to the backend. */
export function validateRange(range: DateRange): RangeError | null {
  const yearOk = (v: string) => {
    const y = Number(v.slice(0, 4));
    return y >= 2000 && y <= 2100;
  };
  if (!isIsoDate(range.from) || !yearOk(range.from)) {
    return 'invalid_from';
  }
  if (!isIsoDate(range.to) || !yearOk(range.to)) {
    return 'invalid_to';
  }
  if (range.from > range.to) {
    return 'from_after_to';
  }
  if (spanDays(range.from, range.to) > MAX_SPAN_DAYS) {
    return 'too_long';
  }
  return null;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** "9 Nov 2026"; month names from the caller's locale when given.
 * Missing or malformed values render as "—" rather than throwing. */
export function formatDay(
  value: string | null | undefined,
  months: readonly string[] = MONTHS
): string {
  if (!isIsoDate(value)) {
    return '—';
  }
  const [y, m, d] = value.split('-').map(Number);
  return `${d} ${months[m - 1] ?? MONTHS[m - 1]} ${y}`;
}

/** India-time "9 Nov 2026, 23:59" for an ISO timestamp from the API. */
export function formatIstDateTime(
  iso: string | null | undefined,
  months: readonly string[] = MONTHS
): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) {
    return '—';
  }
  const shifted = new Date(t + IST_OFFSET_MINUTES * 60_000);
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${formatDay(fromUtc(shifted), months)}, ${hh}:${mm}`;
}
