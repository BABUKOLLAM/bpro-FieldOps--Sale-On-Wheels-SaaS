import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Q } from '@nozbe/watermelondb';
import { v4 as uuidv4 } from 'uuid';
import { database } from '../../db';
import Beat from '../../db/models/Beat';
import BeatCustomer from '../../db/models/BeatCustomer';
import Customer from '../../db/models/Customer';
import Trip, { TRIP_COMPLETED, TRIP_IN_PROGRESS } from '../../db/models/Trip';
import TripCheckpoint from '../../db/models/TripCheckpoint';
import { SYNC_PENDING } from '../../db/models/Invoice';
import { synchronize } from '../../sync/synchronize';
import { startTracking, stopTracking } from '../../sync/locationTracking';
import { getCurrentLocation } from '../../location/geo';
import { useTranslation } from '../../i18n/LanguageContext';
import { colors } from '../../theme/colors';

type Stop = {
  beatCustomer: BeatCustomer;
  customer: Customer | null;
  checkpoint: TripCheckpoint | null;
};

/**
 * Trip Start/End & outlet Check-in/Check-out (BRD FR-08, FM-01) — fully
 * offline, same pattern as Spot Billing: everything is written locally
 * first with sync_status=pending, then pushed opportunistically.
 */
export default function TripScreen() {
  const { t } = useTranslation();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [odometer, setOdometer] = useState('');

  const load = useCallback(async () => {
    const trips = await database
      .get<Trip>('trips')
      .query(Q.where('status', TRIP_IN_PROGRESS))
      .fetch();
    const active = trips[0] || null;
    setTrip(active);
    // Resume foreground GPS tracking if the screen (re)focuses mid-trip —
    // e.g. after the app was backgrounded and reopened.
    if (active) {
      startTracking(active);
    } else {
      stopTracking();
    }

    const beats = await database.get<Beat>('beats').query().fetch();
    const beat = beats[0];
    if (!beat) {
      setStops([]);
      return;
    }
    const beatCustomers = await database
      .get<BeatCustomer>('beat_customers')
      .query(Q.where('beat_server_id', beat.serverId))
      .fetch();

    const nextStops: Stop[] = [];
    for (const bc of beatCustomers.sort(
      (a, b) => a.visitSequence - b.visitSequence
    )) {
      const customers = await database
        .get<Customer>('customers')
        .query(Q.where('server_id', bc.customerServerId))
        .fetch();
      let checkpoint: TripCheckpoint | null = null;
      if (active) {
        const checkpoints = await database
          .get<TripCheckpoint>('trip_checkpoints')
          .query(
            Q.where('trip_local_id', active.id),
            Q.where('customer_server_id', bc.customerServerId)
          )
          .fetch();
        checkpoint = checkpoints[0] || null;
      }
      nextStops.push({
        beatCustomer: bc,
        customer: customers[0] || null,
        checkpoint,
      });
    }
    setStops(nextStops);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function startTrip() {
    // Best-effort — a missing/denied location must never block starting a
    // trip, same principle as offline credit checks never blocking a sale.
    const coords = await getCurrentLocation();

    const created = await database.write(async () => {
      return database.get<Trip>('trips').create((rec) => {
        rec.serverId = uuidv4();
        rec.status = TRIP_IN_PROGRESS;
        rec.startTime = Date.now();
        rec.startOdometer = Number(odometer) || 0;
        rec.localSyncStatus = SYNC_PENDING;
        rec.syncError = '';
        if (coords) {
          rec.startLatitude = coords.latitude;
          rec.startLongitude = coords.longitude;
        }
      });
    });
    setOdometer('');
    startTracking(created);
    await load();
    synchronize().catch(() => {});
  }

  async function endTrip() {
    if (!trip) {
      return;
    }
    const coords = await getCurrentLocation();
    stopTracking();

    await database.write(async () => {
      await trip.update((rec) => {
        rec.status = TRIP_COMPLETED;
        rec.endTime = Date.now();
        rec.endOdometer = Number(odometer) || rec.startOdometer;
        rec.localSyncStatus = SYNC_PENDING;
        if (coords) {
          rec.endLatitude = coords.latitude;
          rec.endLongitude = coords.longitude;
        }
      });
    });
    setOdometer('');
    Alert.alert(t.trip.tripEndedTitle, t.trip.tripEndedBody);
    await load();
    synchronize().catch(() => {});
  }

  async function toggleCheckpoint(stop: Stop) {
    if (!trip || !stop.customer) {
      return;
    }
    const coords = await getCurrentLocation();

    await database.write(async () => {
      if (!stop.checkpoint) {
        await database.get<TripCheckpoint>('trip_checkpoints').create((rec) => {
          rec.serverId = uuidv4();
          rec.trip.set(trip);
          rec.tripServerId = trip.serverId;
          rec.customerServerId = stop.customer!.serverId;
          rec.checkInTime = Date.now();
          rec.localSyncStatus = SYNC_PENDING;
          rec.syncError = '';
          if (coords) {
            rec.checkInLatitude = coords.latitude;
            rec.checkInLongitude = coords.longitude;
          }
        });
      } else if (!stop.checkpoint.checkOutTime) {
        await stop.checkpoint.update((rec) => {
          rec.checkOutTime = Date.now();
          rec.localSyncStatus = SYNC_PENDING;
          if (coords) {
            rec.checkOutLatitude = coords.latitude;
            rec.checkOutLongitude = coords.longitude;
          }
        });
      }
    });
    await load();
  }

  if (!trip) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t.trip.startTitle}</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder={t.trip.odometerStartPlaceholder}
          placeholderTextColor={colors.textSecondary}
          value={odometer}
          onChangeText={setOdometer}
        />
        <TouchableOpacity style={styles.primaryButton} onPress={startTrip}>
          <Text style={styles.startButtonText}>{t.trip.startTrip}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t.trip.inProgressTitle}</Text>
      <Text style={styles.subtitle}>
        {t.trip.startedAtOdometerPrefix}
        {trip.startOdometer}
      </Text>

      <FlatList
        data={stops}
        keyExtractor={(s) => s.beatCustomer.id}
        renderItem={({ item }) => {
          const status = !item.checkpoint
            ? t.trip.notVisited
            : !item.checkpoint.checkOutTime
            ? t.trip.checkedIn
            : t.trip.checkedOut;
          return (
            <TouchableOpacity
              style={styles.stopRow}
              onPress={() => toggleCheckpoint(item)}
            >
              <Text style={styles.stopName}>{item.customer?.name}</Text>
              <Text style={styles.stopStatus}>{status}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <TextInput
        style={styles.input}
        keyboardType="numeric"
        placeholder={t.trip.odometerEndPlaceholder}
        placeholderTextColor={colors.textSecondary}
        value={odometer}
        onChangeText={setOdometer}
      />
      <TouchableOpacity style={styles.endButton} onPress={endTrip}>
        <Text style={styles.endButtonText}>{t.trip.endTrip}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginBottom: 16 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    fontSize: 16,
    color: colors.textPrimary,
    marginVertical: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
  },
  startButtonText: { color: colors.onPrimary, fontSize: 17, fontWeight: '700' },
  endButton: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
  },
  endButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  stopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  stopName: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  stopStatus: { color: colors.textSecondary, fontSize: 13 },
});
