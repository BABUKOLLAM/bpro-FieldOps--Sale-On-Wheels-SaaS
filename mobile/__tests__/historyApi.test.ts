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
  const page = (n: number, next: string | null, count = n) => ({
    count,
    next,
    results: Array.from({ length: n }, (_, i) => ({ id: `r${i}` })),
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
    apiGet.mockResolvedValueOnce(page(10, null, 60));
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
