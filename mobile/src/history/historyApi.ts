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
  return `vansales.history.${agentId}.${kind}.${range.from}_${range.to}`;
}

export type HistoryResult = {
  rows: HistoryRow[];
  count: number;
  hasMore: boolean;
  /** Epoch ms the rows were fetched from the server. */
  fetchedAt: number;
  /** True when served from the on-device cache (offline / server error). */
  fromCache: boolean;
};

type CacheEntry = Omit<HistoryResult, 'fromCache'>;

async function readCache(key: string): Promise<CacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as CacheEntry) : null;
  } catch {
    return null;
  }
}

async function writeCache(key: string, entry: CacheEntry): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Best effort — a failed cache write never blocks showing results.
  }
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
  const page = previous ? Math.floor(previous.rows.length / PAGE_SIZE) + 1 : 1;

  if (!(await isOnline())) {
    const cached = await readCache(key);
    if (cached) {
      return { ...cached, fromCache: true };
    }
    throw new OfflineNoCacheError();
  }

  try {
    const data = await apiGetJson<Paginated<HistoryRow>>(
      historyPath(kind, range, agentId, page)
    );
    const rows = previous ? [...previous.rows, ...data.results] : data.results;
    const entry: CacheEntry = {
      rows,
      count: data.count,
      hasMore: Boolean(data.next),
      fetchedAt: Date.now(),
    };
    await writeCache(key, entry);
    return { ...entry, fromCache: false };
  } catch (err: any) {
    if (err?.status === 400) {
      throw err;
    }
    const cached = await readCache(key);
    if (cached && !previous) {
      return { ...cached, fromCache: true };
    }
    throw err;
  }
}

export class OfflineNoCacheError extends Error {
  constructor() {
    super('offline-no-cache');
  }
}
