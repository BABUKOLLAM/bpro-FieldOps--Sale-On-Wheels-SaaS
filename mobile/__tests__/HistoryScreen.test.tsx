jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../src/api/client', () => ({
  apiGetJson: jest.fn(),
  ApiError: class extends Error {},
}));
jest.mock('../src/sync/synchronize', () => ({ isOnline: jest.fn() }));
const mockLogout = jest.fn();
jest.mock('../src/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'agent-1', username: 'agent' },
    logout: mockLogout,
  }),
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
import {
  AuthExpiredError,
  type HistoryKind,
  loadHistory,
} from '../src/history/historyApi';
import {
  type DateRange,
  presetRange,
  todayInIndia,
} from '../src/history/dateRange';

const load = loadHistory as jest.Mock;
let tree: renderer.ReactTestRenderer | null = null;

function texts(): string {
  return tree!.root
    .findAllByType(Text)
    .map((n) => [].concat(n.props.children).join(''))
    .join('|');
}

function press(label: string) {
  const button = tree!.root
    .findAllByType(TouchableOpacity)
    .find((b) =>
      b.findAllByType(Text).some((tx) => tx.props.children === label)
    );
  if (!button) {
    throw new Error(`no button ${label}`);
  }
  return act(async () => {
    button.props.onPress();
  });
}

function result(kind: HistoryKind, range: DateRange, rows: object[]) {
  return {
    kind,
    range,
    rows,
    page: 1,
    count: rows.length,
    hasMore: false,
    fetchedAt: Date.now(),
    fromCache: false,
  };
}

async function render(params?: object) {
  await act(async () => {
    tree = renderer.create(
      <LanguageProvider>
        <HistoryScreen route={{ params }} />
      </LanguageProvider>
    );
  });
}

const todayRange = () => presetRange('today', todayInIndia());
const ORDER = {
  id: 'o1',
  order_no: 'SO-1',
  customer_name: 'Test Store',
  order_date: '2026-11-09',
  status: 'open',
  lines: [{ qty: '2', rate: '50' }],
};

beforeEach(() => {
  load.mockReset();
  mockLogout.mockReset();
});
afterEach(() => {
  act(() => tree?.unmount());
  tree = null;
});

it("loads today's orders for the signed-in agent and renders rows", async () => {
  load.mockResolvedValue(result('orders', todayRange(), [ORDER]));
  await render();
  expect(load).toHaveBeenCalledWith('orders', todayRange(), 'agent-1');
  const all = texts();
  expect(all).toContain('Test Store');
  expect(all).toContain('₹100');
  expect(all).toContain('est., before tax/discount');
  expect(all).toContain('Open'); // status translated
});

it('H1: switching tabs while a load is pending never renders the old rows in the new layout', async () => {
  let resolveOrders!: (v: unknown) => void;
  load.mockImplementationOnce(() => new Promise((r) => (resolveOrders = r)));
  load.mockImplementationOnce(() => new Promise(() => {})); // receipts pending
  await render();
  await press('Collections');
  // The orders response arrives late — after the switch.
  await act(async () => {
    resolveOrders(result('orders', todayRange(), [ORDER]));
  });
  expect(texts()).not.toContain('Test Store');
  expect(load).toHaveBeenLastCalledWith('receipts', todayRange(), 'agent-1');
});

it('H1: a result for another kind is never rendered even if delivered', async () => {
  // e.g. a stale cache entry tagged with a different kind
  load.mockResolvedValue(result('orders', todayRange(), [ORDER]));
  await render({ kind: 'attendance' });
  expect(texts()).not.toContain('Test Store');
});

it('rows with missing fields render "—" instead of crashing', async () => {
  load.mockResolvedValue(
    result('receipts', todayRange(), [
      { id: 'r1', customer_name: null, received_at: null, mode: null },
    ])
  );
  await render({ kind: 'receipts' });
  expect(texts()).toContain('r1 · — · —');
});

it('switching preset reloads with the new range; empty state shows', async () => {
  load.mockImplementation((kind, range) =>
    Promise.resolve(result(kind, range, []))
  );
  await render({ kind: 'receipts' });
  await press('Last month');
  expect(load).toHaveBeenLastCalledWith(
    'receipts',
    presetRange('last_month', todayInIndia()),
    'agent-1'
  );
  expect(texts()).toContain('Nothing in this date range.');
});

it('offline with a cached result shows the offline banner', async () => {
  load.mockResolvedValue({
    ...result('orders', todayRange(), []),
    fetchedAt: Date.UTC(2026, 10, 9, 6, 0),
    fromCache: true,
  });
  await render();
  expect(texts()).toContain(
    'Offline — showing results saved 9 Nov 2026, 11:30'
  );
});

it('an expired session signs the user out', async () => {
  load.mockRejectedValue(new AuthExpiredError());
  await render();
  expect(mockLogout).toHaveBeenCalled();
});
