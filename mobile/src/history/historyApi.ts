/**
 * "My history" data access: the backend's dated list APIs, narrowed to
 * the signed-in agent and a From–To range, with an AsyncStorage cache of
 * the last good result per (user, kind, range) for offline viewing.
 *
 * Scope: field agents are already restricted server-side to their own
 * records (OwnScopedViewSet / per-app get_queryset). The explicit
 * `agent=<me>` filter additionally keeps a supervisor who signs into the
 * app seeing only their own records here, as this screen promises.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiGetJson } from '../api/client';
import { isOnline } from '../sync/synchronize';
import type { DateRange } from './dateRange';
import { CACHE_PREFIX } from './historyCache';

export { clearHistoryCache } from './historyCache';

export type HistoryKind =
  | 'orders'
  | 'receipts'
  | 'returns'
  | 'expenses'
  | 'attendance';

export const HISTORY_KINDS: HistoryKind[] = [
  'orders',
  'receipts',
  'returns',
  'expenses',
  'attendance',
];

const ENDPOINTS: Record<HistoryKind, string> = {
  orders: '/api/sales/orders/',
  receipts: '/api/sales/receipts/',
  returns: '/api/sales/credit-notes/',
  expenses: '/api/expenses/',
  attendance: '/api/attendance/',
};

export const PAGE_SIZE = 50;

export type Paginated<T> = {
  count: number;
  next: string | null;
  results: T[];
};

export type HistoryRow = Record<string, any> & { id: string };

export function historyPath(
  kind: HistoryKind,
  range: DateRange,
  agentId: string,
  page = 1
): string {
  const params = [
    `agent=${encodeURIComponent(agentId)}`,
    `date_from=${range.from}`,
    `date_to=${range.to}`,
    `page=${page}`,
    `page_size=${PAGE_SIZE}`,
  ];
  return `${ENDPOINTS[kind]}?${params.join('&')}`;
}

export function cacheKey(
  kind: HistoryKind,
  range: DateRange,
  agentId: string
): string {
  return `${CACHE_PREFIX}${agentId}.${kind}.${range.from}_${range.to}`;
}

/** Most recent date ranges kept on the device per user (each range holds
 * up to one entry per kind); older ranges are evicted. */
export const MAX_CACHED_RANGES = 5;
/** Rows kept per cached (user, kind, range); the screen shows more when
 * online via "Load more", but the device copy stays bounded. */
export const MAX_CACHED_ROWS = 200;

function indexKey(agentId: string): string {
  return `${CACHE_PREFIX}${agentId}.__ranges`;
}

function rangeId(range: DateRange): string {
  return `${range.from}_${range.to}`;
}

export type HistoryResult = {
  /** What this result is for — the screen renders it only when these
   * still match the selected tab and range. */
  kind: HistoryKind;
  range: DateRange;
  rows: HistoryRow[];
  /** Last server page loaded (drives "Load more"). */
  page: number;
  count: number;
  hasMore: boolean;
  /** Epoch ms the rows were fetched from the server. */
  fetchedAt: number;
  /** True when served from the on-device cache (offline / server error). */
  fromCache: boolean;
};

type CacheEntry = Omit<HistoryResult, 'fromCache'>;

/** The session expired (401 after the client's own refresh attempt) —
 * the screen signs the user out instead of showing stale data. */
export class AuthExpiredError extends Error {
  constructor() {
    super('auth-expired');
  }
}

/** Only connectivity problems and server faults fall back to the cache;
 * 4xx answers (bad range, auth, permission) are real answers. */
function isTransient(err: unknown): boolean {
  // ApiError (api/client.ts) carries the HTTP status; anything without
  // one is a fetch failure.
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === 'number') {
    return status >= 500;
  }
  return true; // fetch threw: offline, DNS, timeout, TLS
}

async function readCache(key: string): Promise<CacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as CacheEntry) : null;
  } catch {
    return null;
  }
}

async function writeCache(
  agentId: string,
  key: string,
  entry: CacheEntry
): Promise<void> {
  try {
    const bounded: CacheEntry = {
      ...entry,
      rows: entry.rows.slice(0, MAX_CACHED_ROWS),
    };
    await AsyncStorage.setItem(key, JSON.stringify(bounded));
    await touchRange(agentId, entry.range);
  } catch {
    // Best effort — a failed cache write never blocks showing results.
  }
}

/** LRU of the user's cached ranges; evicts every kind's entry for a
 * range that falls off the end. */
async function touchRange(agentId: string, range: DateRange): Promise<void> {
  const raw = await AsyncStorage.getItem(indexKey(agentId));
  const ranges: string[] = raw ? JSON.parse(raw) : [];
  const id = rangeId(range);
  const next = [id, ...ranges.filter((r) => r !== id)];
  const evicted = next.slice(MAX_CACHED_RANGES);
  await AsyncStorage.setItem(
    indexKey(agentId),
    JSON.stringify(next.slice(0, MAX_CACHED_RANGES))
  );
  if (evicted.length) {
    const keys = evicted.flatMap((r) =>
      HISTORY_KINDS.map((k) => `${CACHE_PREFIX}${agentId}.${k}.${r}`)
    );
    await AsyncStorage.multiRemove(keys);
  }
}

function dedupeById(rows: HistoryRow[]): HistoryRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

/**
 * Page 1 (or a further page appended to `previous`) of the agent's
 * history. Offline or on a network/server failure, falls back to the
 * cached result for the same range; throws only when there is no cache
 * either. A 400 (bad range) is never masked by the cache.
 */
export async function loadHistory(
  kind: HistoryKind,
  range: DateRange,
  agentId: string,
  previous?: HistoryResult
): Promise<HistoryResult> {
  const key = cacheKey(kind, range, agentId);
  const page = previous ? previous.page + 1 : 1;

  if (!(await isOnline())) {
    const cached = await readCache(key);
    if (cached) {
      return { ...cached, kind, range, fromCache: true };
    }
    throw new OfflineNoCacheError();
  }

  try {
    const data = await apiGetJson<Paginated<HistoryRow>>(
      historyPath(kind, range, agentId, page)
    );
    // Pages can shift while paging (a new record lands on page 1), so
    // the same row may arrive twice — keep the first copy.
    const rows = previous
      ? dedupeById([...previous.rows, ...data.results])
      : data.results;
    const entry: CacheEntry = {
      kind,
      range,
      rows,
      page,
      count: data.count,
      hasMore: Boolean(data.next),
      fetchedAt: Date.now(),
    };
    await writeCache(agentId, key, entry);
    return { ...entry, fromCache: false };
  } catch (err: any) {
    if (err?.status === 401) {
      throw new AuthExpiredError();
    }
    if (!isTransient(err)) {
      throw err;
    }
    const cached = await readCache(key);
    if (cached && !previous) {
      return { ...cached, kind, range, fromCache: true };
    }
    throw err;
  }
}

export class OfflineNoCacheError extends Error {
  constructor() {
    super('offline-no-cache');
  }
}
