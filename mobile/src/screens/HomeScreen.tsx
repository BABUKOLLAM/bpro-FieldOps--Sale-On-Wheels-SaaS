import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Q } from '@nozbe/watermelondb';
import { database } from '../db';
import Beat from '../db/models/Beat';
import BeatCustomer from '../db/models/BeatCustomer';
import Customer from '../db/models/Customer';
import Trip, { TRIP_IN_PROGRESS } from '../db/models/Trip';
import Attendance from '../db/models/Attendance';
import { synchronize } from '../sync/synchronize';
import { useAuth } from '../auth/AuthContext';
import { useTranslation } from '../i18n/LanguageContext';
import { LOCALE_LABELS, type Locale } from '../i18n/locales';
import { colors } from '../theme/colors';
import IconChip, { ChipButton, Icon, RiseIn } from '../components/IconChip';

const LOCALE_ORDER: Locale[] = ['en', 'ml', 'ta'];

type Stop = { beatCustomer: BeatCustomer; customer: Customer | null };

export default function HomeScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const { locale, t, setLocale } = useTranslation();
  const [stops, setStops] = useState<Stop[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncFailures, setSyncFailures] = useState<{
    count: number;
    firstError: string;
  }>({ count: 0, firstError: '' });
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  const loadData = useCallback(async () => {
    const beats = await database.get<Beat>('beats').query().fetch();
    const allStops: Stop[] = [];
    for (const beat of beats) {
      const beatCustomers = await database
        .get<BeatCustomer>('beat_customers')
        .query(Q.where('beat_server_id', beat.serverId))
        .fetch();
      for (const bc of beatCustomers) {
        const matches = await database
          .get<Customer>('customers')
          .query(Q.where('server_id', bc.customerServerId))
          .fetch();
        allStops.push({ beatCustomer: bc, customer: matches[0] || null });
      }
    }
    allStops.sort(
      (a, b) => a.beatCustomer.visitSequence - b.beatCustomer.visitSequence
    );
    setStops(allStops);

    const trips = await database
      .get<Trip>('trips')
      .query(Q.where('status', TRIP_IN_PROGRESS))
      .fetch();
    setActiveTrip(trips[0] || null);

    const openAttendance = await database
      .get<Attendance>('attendance')
      .query(Q.where('check_out_at', null))
      .fetch();
    setCheckedIn(openAttendance.length > 0);

    // Sync-failure surface: without this, a rejected push (credit block,
    // stale price, validation error) was only visible to the back office
    // in the admin sync-log — the salesman just saw their work silently
    // never arrive. Count every device-originated record stuck in
    // sync_status=failed and show the first stored backend reason.
    let failedCount = 0;
    let firstError = '';
    const deviceTables = [
      'invoices',
      'trips',
      'trip_checkpoints',
      'expenses',
      'receipts',
      'sales_orders',
      'credit_notes',
      'attendance',
    ];
    for (const table of deviceTables) {
      const failedRecords = await database
        .get(table)
        .query(Q.where('sync_status', 'failed'))
        .fetch();
      failedCount += failedRecords.length;
      if (!firstError) {
        const withError = failedRecords.find(
          (r: any) => r.syncError && r.syncError.length > 0
        );
        if (withError) {
          firstError = (withError as any).syncError;
        }
      }
    }
    setSyncFailures({ count: failedCount, firstError });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await synchronize();
      setSyncMessage(
        `${t.home.syncedMessage} ${result.pushed} ${t.home.pushed}${
          result.failed ? `, ${result.failed} ${t.home.failed}` : ''
        }.`
      );
      await loadData();
    } catch {
      setSyncMessage(t.home.syncFailedMessage);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Hi, {user?.first_name || user?.username}
          </Text>
          <Text style={styles.role}>{user?.roles?.join(', ')}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.languagePill}
            onPress={() => setShowLanguagePicker(true)}
            accessibilityLabel={t.home.language}
          >
            <Icon name="language" size={14} color={colors.textSecondary} />
            <Text style={styles.languagePillText}>{LOCALE_LABELS[locale]}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Icon name="signOut" size={16} color={colors.danger} />
            <Text style={styles.logout}>{t.home.signOut}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {syncFailures.count > 0 && (
        <View style={styles.failureBanner}>
          <View style={styles.failureBannerIcon}>
            <IconChip name="syncFailure" accent="alerts" size={28} />
          </View>
          <View style={styles.failureBannerText}>
            <Text style={styles.failureBannerTitle}>
              {syncFailures.count} {t.home.notSynced}
            </Text>
            {syncFailures.firstError ? (
              <Text style={styles.failureBannerReason} numberOfLines={2}>
                {syncFailures.firstError}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.failureBannerRetry}
            onPress={handleSync}
            disabled={syncing}
          >
            <Text style={styles.failureBannerRetryText}>
              {t.home.retrySync}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ChipButton
        icon="checkedIn"
        accent="people"
        label={checkedIn ? t.home.checkedInCheckOut : t.home.checkIn}
        style={[
          styles.attendanceButton,
          checkedIn && styles.attendanceButtonActive,
        ]}
        textStyle={[
          styles.attendanceButtonText,
          checkedIn && styles.attendanceButtonTextActive,
        ]}
        chipTone={checkedIn ? ON_SOLID_LIGHT : undefined}
        onPress={() => navigation.navigate('Attendance')}
      />

      <ChipButton
        icon="fleet"
        accent="fleet"
        label={activeTrip ? t.home.tripInProgress : t.home.startTrip}
        style={styles.tripButton}
        textStyle={styles.tripButtonText}
        chipTone={ON_SOLID_DARK}
        onPress={() =>
          navigation.navigate('Trip', { activeTripId: activeTrip?.id })
        }
      />

      <ChipButton
        icon="expense"
        accent="money"
        label={t.home.logExpense}
        style={styles.expenseButton}
        textStyle={styles.expenseButtonText}
        onPress={() => navigation.navigate('Expense')}
      />

      <ChipButton
        icon="collections"
        accent="money"
        label={t.home.logCollection}
        style={styles.expenseButton}
        textStyle={styles.expenseButtonText}
        onPress={() => navigation.navigate('Receipt')}
      />

      <ChipButton
        icon="orders"
        accent="sales"
        label={t.home.logOrder}
        style={styles.expenseButton}
        textStyle={styles.expenseButtonText}
        onPress={() => navigation.navigate('Order')}
      />

      <ChipButton
        icon="returns"
        accent="sales"
        label={t.home.logReturn}
        style={styles.expenseButton}
        textStyle={styles.expenseButtonText}
        onPress={() => navigation.navigate('Return')}
      />

      {/* Sync Now and My History share one row so the home screen keeps
          the same height for Today's Route (the E2E flow taps route stops
          on a pixel_5). */}
      <View style={styles.syncRow}>
        <ChipButton
          icon="sync"
          accent="brand"
          label={t.home.syncNow}
          compact
          style={[styles.syncButton, styles.syncRowItem]}
          textStyle={styles.syncButtonText}
          numberOfLines={1}
          loading={syncing}
          spinnerColor={colors.primary}
          disabled={syncing}
          onPress={handleSync}
        />
        <ChipButton
          icon="history"
          accent="insights"
          label={t.home.myHistory}
          compact
          style={[styles.historyButton, styles.syncRowItem]}
          textStyle={styles.expenseButtonText}
          numberOfLines={1}
          onPress={() => navigation.navigate('History')}
        />
      </View>
      {syncMessage && <Text style={styles.syncMessage}>{syncMessage}</Text>}

      <View style={styles.sectionTitleRow}>
        <Icon name="route" size={16} color={colors.primary} />
        <Text style={styles.sectionTitle}>{t.home.todaysRoute}</Text>
      </View>
      <FlatList
        data={stops}
        keyExtractor={(item) => item.beatCustomer.id}
        renderItem={({ item, index }) => (
          <RiseIn index={index}>
            <TouchableOpacity
              style={styles.stopCard}
              disabled={!item.customer}
              onPress={() =>
                navigation.navigate('SpotBilling', {
                  customerServerId: item.customer?.serverId,
                })
              }
            >
              <IconChip name="visit" accent="brand" size={32} />
              <View style={styles.stopText}>
                <Text style={styles.stopName}>
                  {item.customer?.name || t.home.unknownCustomer}
                </Text>
                <Text style={styles.stopMeta}>
                  {item.customer?.code} · {t.home.outstanding} ₹
                  {item.customer?.outstandingBalance ?? 0}
                </Text>
              </View>
            </TouchableOpacity>
          </RiseIn>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t.home.noRoute}</Text>}
      />

      <Modal
        visible={showLanguagePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <TouchableOpacity
          style={styles.languageModalBackdrop}
          activeOpacity={1}
          onPress={() => setShowLanguagePicker(false)}
        >
          <View style={styles.languageModalCard}>
            {LOCALE_ORDER.map((code) => (
              <TouchableOpacity
                key={code}
                style={[
                  styles.languageOption,
                  code === locale && styles.languageOptionActive,
                ]}
                onPress={() => {
                  setLocale(code);
                  setShowLanguagePicker(false);
                }}
              >
                <Text
                  style={[
                    styles.languageOptionText,
                    code === locale && styles.languageOptionTextActive,
                  ]}
                >
                  {LOCALE_LABELS[code]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// Chips that sit on a solid-coloured button take the button's own text
// colour instead of an accent (an accent tint would vanish on the fill).
const ON_SOLID_DARK = { fg: colors.onPrimary, bg: 'rgba(10,10,10,0.14)' };
const ON_SOLID_LIGHT = { fg: '#fff', bg: 'rgba(255,255,255,0.2)' };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  role: { color: colors.textSecondary, fontSize: 13 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  languagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  languagePillText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  languageModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  languageModalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    width: '100%',
    maxWidth: 280,
  },
  languageOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  languageOptionActive: {
    backgroundColor: colors.primary,
  },
  languageOptionText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  languageOptionTextActive: {
    color: '#fff',
  },
  logoutButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  logout: { color: colors.danger, fontSize: 14 },
  attendanceButton: {
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  attendanceButtonActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  attendanceButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  attendanceButtonTextActive: { color: '#fff' },
  tripButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  tripButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  expenseButton: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  expenseButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  failureBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  failureBannerIcon: { marginRight: 10 },
  failureBannerText: { flex: 1, marginRight: 10 },
  failureBannerTitle: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  failureBannerReason: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  failureBannerRetry: {
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  failureBannerRetryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  syncButton: {
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  syncRow: { flexDirection: 'row', gap: 10 },
  syncRowItem: { flex: 1 },
  historyButton: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  syncButtonText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  syncMessage: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 13,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  stopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
  },
  stopText: { flex: 1 },
  stopName: { color: colors.textPrimary, fontSize: 17, fontWeight: '600' },
  stopMeta: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
});
