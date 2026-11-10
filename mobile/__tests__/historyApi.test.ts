jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../src/api/client', () => ({ apiGetJson: jest.fn() }));
jest.mock('../src/sync/synchronize', () => ({ isOnline: jest.fn() }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiGetJson } from '../src/api/client';
import { isOnline } from '../src/sync/synchronize';
import {
  HISTORY_KINDS,
  OfflineNoCacheError,
  PAGE_SIZE,
  cacheKey,
  historyPath,
  loadHistory,
} from '../src/history/historyApi';

const apiGet = apiGetJson as jest.Mock;
const online = isOnline as jest.Mock;
const range = { from: '2026-11-01', to: '2026-11-09' };
const AGENT = 'agent-uuid-1';

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('historyPath', () => {
  it('sends agent scope, the inclusive range and pagination', () => {
    expect(historyPath('orders', range, AGENT)).toBe(
      '/api/sales/orders/?agent=agent-uuid-1&date_from=2026-11-01&date_to=2026-11-09&page=1&page_size=50'
    );
  });

  it('maps every kind to its list endpoint', () => {
    const paths = HISTORY_KINDS.map(
      (k) => historyPath(k, range, AGENT, 2).split('?')[0]
    );
    expect(paths).toEqual([
      '/api/sales/orders/',
      '/api/sales/receipts/',
      '/api/sales/credit-notes/',
      '/api/expenses/',
      '/api/attendance/',
    ]);
    expect(historyPath('expenses', range, AGENT, 2)).toContain('&page=2&');
  });

  it('cache key is per user, kind and range', () => {
    expect(cacheKey('receipts', range, AGENT)).toBe(
      'vansales.history.agent-uuid-1.receipts.2026-11-01_2026-11-09'
    );
  });
});

describe('loadHistory', () => {
  const page = (n: number, next: string | null, count = n, start = 0) => ({
    count,
    next,
    results: Array.from({ length: n }, (_, i) => ({ id: `r${start + i}` })),
  });

  it('online: fetches, returns fresh rows and caches them', async () => {
    online.mockResolvedValue(true);
    apiGet.mockResolvedValue(page(2, null));
    const res = await loadHistory('orders', range, AGENT);
    expect(res.fromCache).toBe(false);
    expect(res.rows).toHaveLength(2);
    expect(apiGet).toHaveBeenCalledWith(historyPath('orders', range, AGENT, 1));
    expect(
      JSON.parse(
        (await AsyncStorage.getItem(cacheKey('orders', range, AGENT)))!
      ).rows
    ).toHaveLength(2);
  });

  it('offline: serves the cached result without calling the API', async () => {
    online.mockResolvedValue(true);
    apiGet.mockResolvedValue(page(3, null));
    await loadHistory('receipts', range, AGENT);
    online.mockResolvedValue(false);
    apiGet.mockClear();
    const res = await loadHistory('receipts', range, AGENT);
    expect(res.fromCache).toBe(true);
    expect(res.rows).toHaveLength(3);
    expect(apiGet).not.toHaveBeenCalled();
  });

  it('offline with nothing cached: OfflineNoCacheError', async () => {
    online.mockResolvedValue(false);
    await expect(loadHistory('returns', range, AGENT)).rejects.toBeInstanceOf(
      OfflineNoCacheError
    );
  });

  it('server/network failure falls back to cache', async () => {
    online.mockResolvedValue(true);
    apiGet.mockResolvedValueOnce(page(1, null));
    await loadHistory('expenses', range, AGENT);
    apiGet.mockRejectedValueOnce(new TypeError('Network request failed'));
    const res = await loadHistory('expenses', range, AGENT);
    expect(res.fromCache).toBe(true);
  });

  it('a 400 (bad range) is never masked by the cache', async () => {
    online.mockResolvedValue(true);
    apiGet.mockResolvedValueOnce(page(1, null));
    await loadHistory('attendance', range, AGENT);
    apiGet.mockRejectedValueOnce({ status: 400 });
    await expect(loadHistory('attendance', range, AGENT)).rejects.toEqual({
      status: 400,
    });
  });

  it('load more appends the next page and keeps the cache in step', async () => {
    online.mockResolvedValue(true);
    apiGet.mockResolvedValueOnce(page(PAGE_SIZE, 'next-url', 60));
    const first = await loadHistory('orders', range, AGENT);
    expect(first.hasMore).toBe(true);
    apiGet.mockResolvedValueOnce(page(10, null, 60, PAGE_SIZE));
    const second = await loadHistory('orders', range, AGENT, first);
    expect(apiGet).toHaveBeenLastCalledWith(
      historyPath('orders', range, AGENT, 2)
    );
    expect(second.rows).toHaveLength(60);
    expect(second.hasMore).toBe(false);
  });

  it('caches per user: another agent never sees this cache', async () => {
    online.mockResolvedValue(true);
    apiGet.mockResolvedValueOnce(page(2, null));
    await loadHistory('orders', range, AGENT);
    online.mockResolvedValue(false);
    await expect(
      loadHistory('orders', range, 'other-agent')
    ).rejects.toBeInstanceOf(OfflineNoCacheError);
  });
});

describe('review follow-ups', () => {
  const rows = (ids: string[]) => ids.map((id) => ({ id }));

  it('401 → AuthExpiredError, never the cache', async () => {
    const { AuthExpiredError } = require('../src/history/historyApi');
    online.mockResolvedValue(true);
    apiGet.mockResolvedValueOnce({
      count: 1,
      next: null,
      results: rows(['a']),
    });
    await loadHistory('orders', range, AGENT);
    apiGet.mockRejectedValueOnce({ status: 401 });
    await expect(loadHistory('orders', range, AGENT)).rejects.toBeInstanceOf(
      AuthExpiredError
    );
  });

  it('403/404 are real answers; 5xx and network errors use the cache', async () => {
    online.mockResolvedValue(true);
    apiGet.mockResolvedValueOnce({
      count: 1,
      next: null,
      results: rows(['a']),
    });
    await loadHistory('orders', range, AGENT);
    apiGet.mockRejectedValueOnce({ status: 403 });
    await expect(loadHistory('orders', range, AGENT)).rejects.toEqual({
      status: 403,
    });
    apiGet.mockRejectedValueOnce({ status: 503 });
    expect((await loadHistory('orders', range, AGENT)).fromCache).toBe(true);
  });

  it('results are tagged with their kind and range', async () => {
    online.mockResolvedValue(true);
    apiGet.mockResolvedValueOnce({ count: 0, next: null, results: [] });
    const fresh = await loadHistory('returns', range, AGENT);
    expect([fresh.kind, fresh.range]).toEqual(['returns', range]);
    online.mockResolvedValue(false);
    const cached = await loadHistory('returns', range, AGENT);
    expect([cached.kind, cached.range, cached.fromCache]).toEqual([
      'returns',
      range,
      true,
    ]);
  });

  it('load more de-duplicates by id and tracks the page', async () => {
    online.mockResolvedValue(true);
    apiGet.mockResolvedValueOnce({
      count: 4,
      next: 'n',
      results: rows(['a', 'b', 'c']),
    });
    const first = await loadHistory('orders', range, AGENT);
    apiGet.mockResolvedValueOnce({
      count: 4,
      next: null,
      results: rows(['c', 'd']),
    });
    const second = await loadHistory('orders', range, AGENT, first);
    expect(second.rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(second.page).toBe(2);
    apiGet.mockResolvedValueOnce({ count: 4, next: null, results: [] });
    await loadHistory('orders', range, AGENT, second);
    expect(apiGet).toHaveBeenLastCalledWith(
      historyPath('orders', range, AGENT, 3)
    );
  });

  it('caps cached rows at MAX_CACHED_ROWS', async () => {
    const { MAX_CACHED_ROWS } = require('../src/history/historyApi');
    online.mockResolvedValue(true);
    const many = Array.from({ length: MAX_CACHED_ROWS + 50 }, (_, i) => ({
      id: `x${i}`,
    }));
    apiGet.mockResolvedValueOnce({
      count: many.length,
      next: null,
      results: many,
    });
    const res = await loadHistory('orders', range, AGENT);
    expect(res.rows).toHaveLength(MAX_CACHED_ROWS + 50); // screen keeps all
    const stored = JSON.parse(
      (await AsyncStorage.getItem(cacheKey('orders', range, AGENT)))!
    );
    expect(stored.rows).toHaveLength(MAX_CACHED_ROWS);
  });

  it('keeps only the last MAX_CACHED_RANGES ranges per user', async () => {
    const { MAX_CACHED_RANGES } = require('../src/history/historyApi');
    online.mockResolvedValue(true);
    apiGet.mockResolvedValue({ count: 0, next: null, results: [] });
    const ranges = Array.from({ length: MAX_CACHED_RANGES + 1 }, (_, i) => ({
      from: `2026-10-0${i + 1}`,
      to: `2026-10-0${i + 1}`,
    }));
    for (const r of ranges) {
      await loadHistory('orders', r, AGENT);
      await loadHistory('receipts', r, AGENT);
    }
    // Oldest range evicted for every kind; newest kept.
    expect(
      await AsyncStorage.getItem(cacheKey('orders', ranges[0], AGENT))
    ).toBeNull();
    expect(
      await AsyncStorage.getItem(cacheKey('receipts', ranges[0], AGENT))
    ).toBeNull();
    expect(
      await AsyncStorage.getItem(
        cacheKey('orders', ranges[MAX_CACHED_RANGES], AGENT)
      )
    ).not.toBeNull();
    // Another user's cache is untouched by this user's eviction.
    expect(
      (await AsyncStorage.getAllKeys()).filter((k) => k.includes('.orders.'))
    ).toHaveLength(MAX_CACHED_RANGES);
  });

  it('clearHistoryCache removes every history key and nothing else', async () => {
    const { clearHistoryCache } = require('../src/history/historyApi');
    online.mockResolvedValue(true);
    apiGet.mockResolvedValue({ count: 0, next: null, results: [] });
    await loadHistory('orders', range, AGENT);
    await loadHistory('orders', range, 'other-agent');
    await AsyncStorage.setItem('vansales.locale', 'ml');
    await clearHistoryCache();
    expect(await AsyncStorage.getAllKeys()).toEqual(['vansales.locale']);
  });
});
