jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../src/api/client', () => ({ apiGetJson: jest.fn() }));
jest.mock('../src/sync/synchronize', () => ({ isOnline: jest.fn() }));
jest.mock('../src/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'agent-1', username: 'agent' } }),
}));
jest.mock('../src/history/historyApi', () => {
  const actual = jest.requireActual('../src/history/historyApi');
  return { ...actual, loadHistory: jest.fn() };
});

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import HistoryScreen from '../src/screens/history/HistoryScreen';
import { LanguageProvider } from '../src/i18n/LanguageContext';
import { loadHistory } from '../src/history/historyApi';
import { presetRange, todayInIndia } from '../src/history/dateRange';

const load = loadHistory as jest.Mock;

function texts(tree: renderer.ReactTestRenderer): string[] {
  return tree.root
    .findAllByType(Text)
    .map((n) => [].concat(n.props.children).join(''));
}

async function render(params?: object) {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <LanguageProvider>
        <HistoryScreen route={{ params }} />
      </LanguageProvider>
    );
  });
  return tree;
}

beforeEach(() => load.mockReset());

it("loads today's orders for the signed-in agent and renders rows", async () => {
  load.mockResolvedValue({
    rows: [
      {
        id: 'o1',
        order_no: 'SO-1',
        customer_name: 'Test Store',
        order_date: '2026-11-09',
        status: 'open',
        lines: [{ qty: '2', rate: '50' }],
      },
    ],
    count: 1,
    hasMore: false,
    fetchedAt: Date.now(),
    fromCache: false,
  });
  const tree = await render();
  const today = todayInIndia();
  expect(load).toHaveBeenCalledWith(
    'orders',
    { from: today, to: today },
    'agent-1'
  );
  const all = texts(tree).join('|');
  expect(all).toContain('Test Store');
  expect(all).toContain('₹100');
});

it('switching kind and preset reloads with the new range', async () => {
  load.mockResolvedValue({
    rows: [],
    count: 0,
    hasMore: false,
    fetchedAt: Date.now(),
    fromCache: false,
  });
  const tree = await render({ kind: 'receipts' });
  expect(load.mock.calls[0][0]).toBe('receipts');
  const button = tree.root
    .findAllByType(TouchableOpacity)
    .find((b) =>
      b.findAllByType(Text).some((tx) => tx.props.children === 'Last month')
    );
  expect(button).toBeTruthy();
  await act(async () => {
    button!.props.onPress();
  });
  expect(load).toHaveBeenLastCalledWith(
    'receipts',
    presetRange('last_month', todayInIndia()),
    'agent-1'
  );
  expect(texts(tree).join('|')).toContain('Nothing in this date range.');
});

it('offline with a cached result shows the offline banner', async () => {
  load.mockResolvedValue({
    rows: [],
    count: 0,
    hasMore: false,
    fetchedAt: Date.UTC(2026, 10, 9, 6, 0),
    fromCache: true,
  });
  const tree = await render();
  expect(texts(tree).join('|')).toContain(
    'Offline — showing results saved 9 Nov 2026, 11:30'
  );
});
