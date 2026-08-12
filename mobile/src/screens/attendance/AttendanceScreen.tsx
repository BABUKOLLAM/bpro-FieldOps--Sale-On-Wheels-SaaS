import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Q } from '@nozbe/watermelondb';
import { v4 as uuidv4 } from 'uuid';
import { database } from '../../db';
import Attendance from '../../db/models/Attendance';
import { SYNC_PENDING } from '../../db/models/Invoice';
import { synchronize } from '../../sync/synchronize';
import { apiPostJson, ApiError } from '../../api/client';
import { getCurrentLocation } from '../../location/geo';
import { colors } from '../../theme/colors';

/**
 * FR-16 Attendance Check-In/Check-Out: daily start/end capture with a
 * best-effort geo-tag (selfie is explicitly "(optional)" in the BRD's own
 * wording and isn't built here — geo-tag is the load-bearing anti-fraud
 * signal, selfie is a future nice-to-have, not a cut corner).
 *
 * Check-in is created offline-first like every other transaction (synced
 * via the generic push queue). Check-out is a direct online call against
 * the existing record — see sync/synchronize.ts for why re-pushing an
 * update through the same offline queue wouldn't actually reach the
 * database.
 */
export default function AttendanceScreen() {
  const [record, setRecord] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const load = useCallback(async () => {
    const open = await database
      .get<Attendance>('attendance')
      .query(Q.where('check_out_at', null))
      .fetch();
    open.sort((a, b) => b.checkInAt - a.checkInAt);
    setRecord(open[0] || null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleCheckIn() {
    setLoading(true);
    try {
      const coords = await getCurrentLocation();
      await database.write(async () => {
        await database.get<Attendance>('attendance').create((rec) => {
          rec.serverId = uuidv4();
          rec.checkInAt = Date.now();
          rec.deviceCreatedAt = Date.now();
          rec.localSyncStatus = SYNC_PENDING;
          rec.syncError = '';
          if (coords) {
            rec.checkInLatitude = coords.latitude;
            rec.checkInLongitude = coords.longitude;
          }
        });
      });
      await load();
      synchronize().catch(() => {});
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckOut() {
    if (!record) {
      return;
    }
    setCheckingOut(true);
    try {
      const coords = await getCurrentLocation();
      await apiPostJson(`/api/attendance/${record.serverId}/check_out/`, {
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      });
      await database.write(async () => {
        await record.update((rec) => {
          rec.checkOutAt = Date.now();
          if (coords) {
            rec.checkOutLatitude = coords.latitude;
            rec.checkOutLongitude = coords.longitude;
          }
        });
      });
      await load();
      Alert.alert('Checked out', 'Have a good day!');
    } catch (err) {
      const isOffline = !(err instanceof ApiError);
      Alert.alert(
        'Could not check out',
        isOffline
          ? 'You appear to be offline. Check-out needs a connection — try again once you’re back online.'
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <View style={styles.container}>
      {record ? (
        <>
          <Text style={styles.title}>Checked in</Text>
          <Text style={styles.subtitle}>
            Since{' '}
            {new Date(record.checkInAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {record.localSyncStatus === SYNC_PENDING ? ' · syncing…' : ''}
          </Text>
          <TouchableOpacity
            style={styles.checkOutButton}
            onPress={handleCheckOut}
            disabled={checkingOut}
          >
            {checkingOut ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.checkOutButtonText}>Check Out</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.title}>Not checked in</Text>
          <Text style={styles.subtitle}>
            Start your day by checking in — your location is captured for
            attendance verification.
          </Text>
          <TouchableOpacity
            style={styles.checkInButton}
            onPress={handleCheckIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.checkInButtonText}>Check In</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 20,
  },
  checkInButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
  },
  checkOutButton: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
  },
  checkInButtonText: { color: colors.onPrimary, fontSize: 17, fontWeight: '700' },
  checkOutButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
