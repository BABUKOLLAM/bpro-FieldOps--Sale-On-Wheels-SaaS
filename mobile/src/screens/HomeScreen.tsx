import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Q } from '@nozbe/watermelondb';
import { database } from '../db';
import Beat from '../db/models/Beat';
import BeatCustomer from '../db/models/BeatCustomer';
import Customer from '../db/models/Customer';
import Trip, { TRIP_IN_PROGRESS } from '../db/models/Trip';
import { synchronize } from '../sync/synchronize';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme/colors';

type Stop = { beatCustomer: BeatCustomer; customer: Customer | null };

export default function HomeScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const [stops, setStops] = useState<Stop[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
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
    allStops.sort((a, b) => a.beatCustomer.visitSequence - b.beatCustomer.visitSequence);
    setStops(allStops);

    const trips = await database.get<Trip>('trips').query(Q.where('status', TRIP_IN_PROGRESS)).fetch();
    setActiveTrip(trips[0] || null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await synchronize();
      setSyncMessage(`Synced. ${result.pushed} pushed${result.failed ? `, ${result.failed} failed` : ''}.`);
      await loadData();
    } catch {
      setSyncMessage('Sync failed — will retry automatically.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {user?.first_name || user?.username}</Text>
          <Text style={styles.role}>{user?.roles?.join(', ')}</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logout}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.tripButton}
        onPress={() => navigation.navigate('Trip', { activeTripId: activeTrip?.id })}
      >
        <Text style={styles.tripButtonText}>
          {activeTrip ? 'Trip in progress — Manage Trip' : 'Start Trip'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.syncButton} onPress={handleSync} disabled={syncing}>
        {syncing ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.syncButtonText}>Sync Now</Text>}
      </TouchableOpacity>
      {syncMessage && <Text style={styles.syncMessage}>{syncMessage}</Text>}

      <Text style={styles.sectionTitle}>Today's Route</Text>
      <FlatList
        data={stops}
        keyExtractor={(item) => item.beatCustomer.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.stopCard}
            disabled={!item.customer}
            onPress={() => navigation.navigate('SpotBilling', { customerServerId: item.customer?.serverId })}
          >
            <Text style={styles.stopName}>{item.customer?.name || 'Unknown customer'}</Text>
            <Text style={styles.stopMeta}>
              {item.customer?.code} · Outstanding ₹{item.customer?.outstandingBalance ?? 0}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No route assigned. Pull to sync.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  role: { color: colors.textSecondary, fontSize: 13 },
  logout: { color: colors.danger, fontSize: 14 },
  tripButton: { backgroundColor: colors.primary, borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 12 },
  tripButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  syncButton: {
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  syncButtonText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  syncMessage: { color: colors.textSecondary, textAlign: 'center', marginBottom: 12, fontSize: 13 },
  sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginTop: 8, marginBottom: 8 },
  stopCard: { backgroundColor: colors.surface, borderRadius: 10, padding: 16, marginBottom: 10 },
  stopName: { color: colors.textPrimary, fontSize: 17, fontWeight: '600' },
  stopMeta: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
});
