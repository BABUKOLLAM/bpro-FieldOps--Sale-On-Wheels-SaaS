import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { LOCALE_LABELS } from '../i18n/locales';
import { colors } from '../theme/colors';

type Stop = { beatCustomer: BeatCustomer; customer: Customer | null };

export default function HomeScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const { locale, t, setLocale } = useTranslation();
  const [stops, setStops] = useState<Stop[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

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
            onPress={() => setLocale(locale === 'en' ? 'hi' : 'en')}
            accessibilityLabel={t.home.language}
          >
            <Text style={styles.languagePillText}>
              {LOCALE_LABELS[locale === 'en' ? 'hi' : 'en']}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout}>
            <Text style={styles.logout}>{t.home.signOut}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.attendanceButton,
          checkedIn && styles.attendanceButtonActive,
        ]}
        onPress={() => navigation.navigate('Attendance')}
      >
        <Text
          style={[
            styles.attendanceButtonText,
            checkedIn && styles.attendanceButtonTextActive,
          ]}
        >
          {checkedIn ? t.home.checkedInCheckOut : t.home.checkIn}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tripButton}
        onPress={() =>
          navigation.navigate('Trip', { activeTripId: activeTrip?.id })
        }
      >
        <Text style={styles.tripButtonText}>
          {activeTrip ? t.home.tripInProgress : t.home.startTrip}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.expenseButton}
        onPress={() => navigation.navigate('Expense')}
      >
        <Text style={styles.expenseButtonText}>{t.home.logExpense}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.syncButton}
        onPress={handleSync}
        disabled={syncing}
      >
        {syncing ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.syncButtonText}>{t.home.syncNow}</Text>
        )}
      </TouchableOpacity>
      {syncMessage && <Text style={styles.syncMessage}>{syncMessage}</Text>}

      <Text style={styles.sectionTitle}>{t.home.todaysRoute}</Text>
      <FlatList
        data={stops}
        keyExtractor={(item) => item.beatCustomer.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.stopCard}
            disabled={!item.customer}
            onPress={() =>
              navigation.navigate('SpotBilling', {
                customerServerId: item.customer?.serverId,
              })
            }
          >
            <Text style={styles.stopName}>
              {item.customer?.name || t.home.unknownCustomer}
            </Text>
            <Text style={styles.stopMeta}>
              {item.customer?.code} · {t.home.outstanding} ₹
              {item.customer?.outstandingBalance ?? 0}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t.home.noRoute}</Text>}
      />
    </View>
  );
}

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
  logout: { color: colors.danger, fontSize: 14 },
  attendanceButton: {
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
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
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  tripButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  expenseButton: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  expenseButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  syncButton: {
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
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
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
  },
  stopCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
  },
  stopName: { color: colors.textPrimary, fontSize: 17, fontWeight: '600' },
  stopMeta: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
});
