import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
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
  AuthExpiredError,
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
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [today, setToday] = useState(todayInIndia);

  const [kind, setKind] = useState<HistoryKind>(
    route?.params?.kind && HISTORY_KINDS.includes(route.params.kind)
      ? route.params.kind
      : 'orders'
  );
  const [range, setRange] = useState<DateRange>(() =>
    presetRange('today', todayInIndia())
  );
  // The preset the user picked (null = custom). Kept explicitly so that
  // when the India day rolls over, "Today"/"This week"/... move with it.
  const [preset, setPreset] = useState<PresetKey | null>('today');
  const [showCustom, setShowCustom] = useState(false);
  const [fromText, setFromText] = useState(range.from);
  const [toText, setToText] = useState(range.to);
  const [rangeError, setRangeError] = useState<RangeError | null>(null);

  const [result, setResult] = useState<HistoryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<'offline' | 'failed' | null>(null);
  const requestId = useRef(0);

  // L3: recompute presets when the India day changes (screen left open
  // past midnight, or the app resumed the next day).
  useEffect(() => {
    const check = () => {
      const now = todayInIndia();
      setToday((prev) => (prev === now ? prev : now));
    };
    const timer = setInterval(check, 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        check();
      }
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (preset) {
      const next = presetRange(preset, today);
      setRange((prev) =>
        prev.from === next.from && prev.to === next.to ? prev : next
      );
      setFromText(next.from);
      setToText(next.to);
    }
  }, [today, preset]);

  const load = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    const id = ++requestId.current;
    // H1: drop the previous tab's/range's rows at once — they are never
    // rendered through another kind's row layout.
    setResult(null);
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    try {
      const next = await loadHistory(kind, range, user.id);
      if (id === requestId.current) {
        setResult(next);
      }
    } catch (err) {
      if (id === requestId.current) {
        if (err instanceof AuthExpiredError) {
          // Session is gone (refresh already failed) — back to sign-in.
          logout();
          return;
        }
        setResult(null);
        setError(err instanceof OfflineNoCacheError ? 'offline' : 'failed');
      }
    } finally {
      if (id === requestId.current) {
        setLoading(false);
      }
    }
  }, [kind, range, user?.id, logout]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMore() {
    if (!user?.id || !shown || !shown.hasMore || shown.fromCache) {
      return;
    }
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const next = await loadHistory(kind, range, user.id, shown);
      // Ignore if the tab/range changed (a new load started) meanwhile.
      if (id === requestId.current) {
        setResult(next);
      }
    } catch (err) {
      if (id === requestId.current && err instanceof AuthExpiredError) {
        logout();
      }
      // Otherwise keep what is shown; the button stays available to retry.
    } finally {
      if (id === requestId.current) {
        setLoadingMore(false);
      }
    }
  }

  function choosePreset(key: PresetKey) {
    const next = presetRange(key, today);
    setPreset(key);
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
      setPreset(null);
      setRange(next);
    }
  }

  // Render a result only while it still belongs to the selected tab and
  // range (H1) — otherwise treat the screen as loading.
  const shown =
    result &&
    result.kind === kind &&
    result.range.from === range.from &&
    result.range.to === range.to
      ? result
      : null;
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
          ? formatDay(range.from, t.history.months)
          : `${formatDay(range.from, t.history.months)} – ${formatDay(
              range.to,
              t.history.months
            )}`}
        {shown
          ? `  ·  ${t.history.totalPrefix} ${shown.count} ${t.history.recordsSuffix}`
          : ''}
      </Text>

      {shown?.fromCache && (
        <Text style={styles.offlineBanner}>
          {`${t.history.offlineCachedPrefix} ${formatIstDateTime(
            new Date(shown.fetchedAt).toISOString(),
            t.history.months
          )}`}
        </Text>
      )}

      {loading && !shown ? (
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
          data={shown?.rows || []}
          keyExtractor={(row) => row.id}
          renderItem={({ item }) => <Row kind={kind} row={item} t={t} />}
          refreshing={loading}
          onRefresh={load}
          ListEmptyComponent={
            <Text style={styles.empty}>{t.history.empty}</Text>
          }
          ListFooterComponent={
            <View>
              {shown?.hasMore && !shown.fromCache && (
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
  const months = t.history.months;
  const day = (v: unknown) => formatDay(v as string, months);
  const at = (v: unknown) => formatIstDateTime(v as string, months);
  const ref = (no: unknown) => (no ? String(no) : String(row.id).slice(0, 8));
  let title = '';
  let meta = '';
  let amount = '';
  let amountNote = '';
  switch (kind) {
    case 'orders': {
      const total = (Array.isArray(row.lines) ? row.lines : []).reduce(
        (sum: number, l: any) => sum + Number(l?.qty) * Number(l?.rate),
        0
      );
      title = row.customer_name || '—';
      meta = `${ref(row.order_no)} · ${day(row.order_date)} · ${codeLabel(
        STATUS_LABELS(t),
        row.status
      )}`;
      amount = money(total);
      // No server-side order total exists; this is qty × rate only.
      amountNote = t.history.orderTotalNote;
      break;
    }
    case 'receipts':
      title = row.customer_name || '—';
      meta = `${ref(row.receipt_no)} · ${at(row.received_at)} · ${codeLabel(
        MODE_LABELS(t),
        row.mode
      )}`;
      amount = money(row.amount);
      break;
    case 'returns':
      title = row.customer_name || '—';
      meta = `${ref(row.credit_note_no)} · ${day(row.note_date)} · ${codeLabel(
        REASON_LABELS(t),
        row.reason_code
      )}`;
      amount = money(row.grand_total);
      break;
    case 'expenses':
      title = codeLabel(CATEGORY_LABELS(t), row.category);
      meta = `${day(row.expense_date)} · ${codeLabel(
        STATUS_LABELS(t),
        row.status
      )}${row.description ? ` · ${row.description}` : ''}`;
      amount = money(row.amount);
      break;
    case 'attendance': {
      title = at(row.check_in_at);
      meta = row.check_out_at
        ? `${t.history.checkedOutAt} ${at(row.check_out_at)}`
        : t.history.stillCheckedIn;
      const mins = Number(row.duration_minutes);
      amount =
        row.duration_minutes != null && Number.isFinite(mins)
          ? `${Math.floor(mins / 60)}h ${mins % 60}m`
          : '';
      break;
    }
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
      {amount ? (
        <View style={styles.amountBox}>
          <Text style={styles.cardAmount}>{amount}</Text>
          {amountNote ? (
            <Text style={styles.amountNote}>{amountNote}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Translated label for a server code, falling back to a readable form
 * of the code itself (never throws on missing values). */
function codeLabel(map: Record<string, string>, code: unknown): string {
  if (code === null || code === undefined || code === '') {
    return '—';
  }
  const key = String(code);
  return map[key] ?? key.replace(/_/g, ' ');
}

const STATUS_LABELS = (t: Dictionary): Record<string, string> => ({
  open: t.history.statusOpen,
  fulfilled: t.history.statusFulfilled,
  cancelled: t.history.statusCancelled,
  submitted: t.history.statusSubmitted,
  approved: t.history.statusApproved,
  rejected: t.history.statusRejected,
});

// Same label maps the entry screens use (Expense/Receipt/Return).
const CATEGORY_LABELS = (t: Dictionary): Record<string, string> => ({
  fuel: t.expense.categoryFuel,
  toll: t.expense.categoryToll,
  food: t.expense.categoryFood,
  misc: t.expense.categoryMisc,
});

const MODE_LABELS = (t: Dictionary): Record<string, string> => ({
  cash: t.receipt.modeCash,
  cheque: t.receipt.modeCheque,
  upi: t.receipt.modeUpi,
  card: t.receipt.modeCard,
});

const REASON_LABELS = (t: Dictionary): Record<string, string> => ({
  damaged_in_transit: t.return.reasonDamagedInTransit,
  expired_stock: t.return.reasonExpired,
  wrong_item: t.return.reasonWrongItem,
  customer_rejection: t.return.reasonCustomerRejection,
});

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
  amountBox: { alignItems: 'flex-end', maxWidth: 140 },
  amountNote: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
    textAlign: 'right',
  },
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
