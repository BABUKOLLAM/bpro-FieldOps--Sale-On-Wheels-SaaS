import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { useTranslation } from '../../i18n/LanguageContext';
import type { Dictionary } from '../../i18n/locales';
import { colors } from '../../theme/colors';
import {
  type DateRange,
  type PresetKey,
  type RangeError,
  PRESET_ORDER,
  formatDay,
  formatIstDateTime,
  matchPreset,
  presetRange,
  todayInIndia,
  validateRange,
} from '../../history/dateRange';
import {
  type HistoryKind,
  type HistoryResult,
  type HistoryRow,
  HISTORY_KINDS,
  OfflineNoCacheError,
  loadHistory,
} from '../../history/historyApi';

/**
 * "My history": the signed-in agent's own orders, collections, returns,
 * expenses and attendance for a From–To range (India-time days,
 * inclusive). Read-only and online-first; when offline it shows the last
 * result loaded for the same range, so it never blocks the entry screens
 * (which stay fully offline via WatermelonDB).
 */
export default function HistoryScreen({ route }: any) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const today = todayInIndia();

  const [kind, setKind] = useState<HistoryKind>(
    route?.params?.kind && HISTORY_KINDS.includes(route.params.kind)
      ? route.params.kind
      : 'orders'
  );
  const [range, setRange] = useState<DateRange>(presetRange('today', today));
  const [showCustom, setShowCustom] = useState(false);
  const [fromText, setFromText] = useState(range.from);
  const [toText, setToText] = useState(range.to);
  const [rangeError, setRangeError] = useState<RangeError | null>(null);

  const [result, setResult] = useState<HistoryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<'offline' | 'failed' | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const next = await loadHistory(kind, range, user.id);
      if (id === requestId.current) {
        setResult(next);
      }
    } catch (err) {
      if (id === requestId.current) {
        setResult(null);
        setError(err instanceof OfflineNoCacheError ? 'offline' : 'failed');
      }
    } finally {
      if (id === requestId.current) {
        setLoading(false);
      }
    }
  }, [kind, range, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMore() {
    if (!user?.id || !result || !result.hasMore || result.fromCache) {
      return;
    }
    setLoadingMore(true);
    try {
      setResult(await loadHistory(kind, range, user.id, result));
    } catch {
      // Keep what is already shown; the button stays available to retry.
    } finally {
      setLoadingMore(false);
    }
  }

  function choosePreset(key: PresetKey) {
    const next = presetRange(key, today);
    setShowCustom(false);
    setRangeError(null);
    setFromText(next.from);
    setToText(next.to);
    setRange(next);
  }

  function applyCustom() {
    const next = { from: fromText.trim(), to: toText.trim() };
    const problem = validateRange(next);
    setRangeError(problem);
    if (!problem) {
      setRange(next);
    }
  }

  const presetMatch = matchPreset(range, today);
  const activePreset = showCustom ? null : presetMatch;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroller}
        contentContainerStyle={styles.chipRow}
      >
        {HISTORY_KINDS.map((k) => (
          <Chip
            key={k}
            label={kindLabel(t, k)}
            active={kind === k}
            onPress={() => setKind(k)}
          />
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroller}
        contentContainerStyle={styles.chipRow}
      >
        {PRESET_ORDER.map((p) => (
          <Chip
            key={p}
            label={presetLabel(t, p)}
            active={activePreset === p}
            onPress={() => choosePreset(p)}
          />
        ))}
        <Chip
          label={t.history.custom}
          active={showCustom || presetMatch === null}
          onPress={() => setShowCustom(true)}
        />
      </ScrollView>

      {showCustom && (
        <View style={styles.customBox}>
          <View style={styles.customRow}>
            <View style={styles.customField}>
              <Text style={styles.label}>{t.history.from}</Text>
              <TextInput
                style={styles.input}
                value={fromText}
                onChangeText={setFromText}
                placeholder="2026-11-01"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                autoCorrect={false}
              />
            </View>
            <View style={styles.customField}>
              <Text style={styles.label}>{t.history.to}</Text>
              <TextInput
                style={styles.input}
                value={toText}
                onChangeText={setToText}
                placeholder="2026-11-09"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                autoCorrect={false}
              />
            </View>
          </View>
          {rangeError && (
            <Text style={styles.error}>{rangeErrorText(t, rangeError)}</Text>
          )}
          <TouchableOpacity style={styles.applyButton} onPress={applyCustom}>
            <Text style={styles.applyButtonText}>{t.history.apply}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.rangeLabel}>
        {range.from === range.to
          ? formatDay(range.from)
          : `${formatDay(range.from)} – ${formatDay(range.to)}`}
        {result
          ? `  ·  ${t.history.totalPrefix} ${result.count} ${t.history.recordsSuffix}`
          : ''}
      </Text>

      {result?.fromCache && (
        <Text style={styles.offlineBanner}>
          {`${t.history.offlineCachedPrefix} ${formatIstDateTime(
            new Date(result.fetchedAt).toISOString()
          )}`}
        </Text>
      )}

      {loading && !result ? (
        <ActivityIndicator
          style={styles.spinner}
          size="large"
          color={colors.primary}
        />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.empty}>
            {error === 'offline'
              ? t.history.offlineNoCache
              : t.history.loadFailed}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={load}>
            <Text style={styles.retryButtonText}>{t.history.retry}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={result?.rows || []}
          keyExtractor={(row) => row.id}
          renderItem={({ item }) => <Row kind={kind} row={item} t={t} />}
          refreshing={loading}
          onRefresh={load}
          ListEmptyComponent={
            <Text style={styles.empty}>{t.history.empty}</Text>
          }
          ListFooterComponent={
            <View>
              {result?.hasMore && !result.fromCache && (
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Text style={styles.retryButtonText}>
                      {t.history.loadMore}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              <Text style={styles.note}>{t.history.unsyncedNote}</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function money(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN')}` : '—';
}

function Row({
  kind,
  row,
  t,
}: {
  kind: HistoryKind;
  row: HistoryRow;
  t: Dictionary;
}) {
  let title = '';
  let meta = '';
  let amount = '';
  switch (kind) {
    case 'orders': {
      const total = (row.lines || []).reduce(
        (sum: number, l: any) => sum + Number(l.qty) * Number(l.rate),
        0
      );
      title = row.customer_name || '—';
      meta = `${row.order_no || row.id.slice(0, 8)} · ${formatDay(
        row.order_date
      )} · ${row.status}`;
      amount = money(total);
      break;
    }
    case 'receipts':
      title = row.customer_name || '—';
      meta = `${row.receipt_no || row.id.slice(0, 8)} · ${formatIstDateTime(
        row.received_at
      )} · ${String(row.mode).toUpperCase()}`;
      amount = money(row.amount);
      break;
    case 'returns':
      title = row.customer_name || '—';
      meta = `${row.credit_note_no || row.id.slice(0, 8)} · ${formatDay(
        row.note_date
      )} · ${String(row.reason_code).replace(/_/g, ' ')}`;
      amount = money(row.grand_total);
      break;
    case 'expenses':
      title = String(row.category).replace(/^./, (c) => c.toUpperCase());
      meta = `${formatDay(row.expense_date)} · ${row.status}${
        row.description ? ` · ${row.description}` : ''
      }`;
      amount = money(row.amount);
      break;
    case 'attendance':
      title = formatIstDateTime(row.check_in_at);
      meta = row.check_out_at
        ? `${t.history.checkedOutAt} ${formatIstDateTime(row.check_out_at)}`
        : t.history.stillCheckedIn;
      amount =
        row.duration_minutes != null
          ? `${Math.floor(row.duration_minutes / 60)}h ${
              row.duration_minutes % 60
            }m`
          : '';
      break;
  }
  return (
    <View style={styles.card}>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={2}>
          {meta}
        </Text>
      </View>
      {amount ? <Text style={styles.cardAmount}>{amount}</Text> : null}
    </View>
  );
}

function kindLabel(t: Dictionary, kind: HistoryKind): string {
  return {
    orders: t.history.kindOrders,
    receipts: t.history.kindReceipts,
    returns: t.history.kindReturns,
    expenses: t.history.kindExpenses,
    attendance: t.history.kindAttendance,
  }[kind];
}

function presetLabel(t: Dictionary, key: PresetKey): string {
  return {
    today: t.history.presetToday,
    yesterday: t.history.presetYesterday,
    this_week: t.history.presetThisWeek,
    last_7: t.history.presetLast7,
    mtd: t.history.presetMtd,
    last_month: t.history.presetLastMonth,
    last_30: t.history.presetLast30,
  }[key];
}

function rangeErrorText(t: Dictionary, err: RangeError): string {
  return {
    invalid_from: t.history.errInvalidFrom,
    invalid_to: t.history.errInvalidTo,
    from_after_to: t.history.errFromAfterTo,
    too_long: t.history.errTooLong,
  }[err];
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 12 },
  chipScroller: { flexGrow: 0, marginBottom: 8 },
  chipRow: { gap: 8, paddingHorizontal: 16 },
  chip: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textPrimary, fontSize: 14 },
  chipTextActive: { color: colors.onPrimary, fontWeight: '600' },
  customBox: { paddingHorizontal: 16, marginBottom: 8 },
  customRow: { flexDirection: 'row', gap: 10 },
  customField: { flex: 1 },
  label: { color: colors.textSecondary, fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: colors.textPrimary,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: 8 },
  applyButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  applyButtonText: { color: colors.onPrimary, fontSize: 15, fontWeight: '700' },
  rangeLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  offlineBanner: {
    color: colors.warning,
    fontSize: 13,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  spinner: { marginTop: 40 },
  errorBox: { paddingHorizontal: 16 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  cardText: { flex: 1, marginRight: 10 },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  cardMeta: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  cardAmount: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
  retryButton: {
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  retryButtonText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  note: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
});
