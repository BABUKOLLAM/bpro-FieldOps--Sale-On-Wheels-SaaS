import { v4 as uuidv4 } from 'uuid';
import { database } from '../db';
import LocationPing from '../db/models/LocationPing';
import Trip from '../db/models/Trip';
import { SYNC_PENDING } from '../db/models/Invoice';
import { getCurrentLocation } from '../location/geo';
import { synchronize } from './synchronize';

const PING_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Foreground periodic GPS breadcrumb capture (FR-05 real-time field
 * tracking, FM-02 vehicle tracking) while a trip is in progress.
 *
 * Deliberately NOT a background service: true always-on tracking needs
 * native project configuration (Android foreground service +
 * notification, iOS background location mode / Info.plist entries) that
 * this codebase's not-yet-generated ios/android projects don't include
 * (see mobile/README.md). This ticks only while the app is open and a
 * trip is active — real, working code, just short of 24/7 background
 * tracking, and documented as such rather than silently overclaiming.
 */
export function startTracking(trip: Trip): void {
  stopTracking();
  intervalId = setInterval(async () => {
    const coords = await getCurrentLocation();
    if (!coords) {
      return;
    } // no fix this cycle — try again next interval

    await database.write(async () => {
      await database.get<LocationPing>('location_pings').create((rec) => {
        rec.serverId = uuidv4();
        rec.trip.set(trip);
        rec.tripServerId = trip.serverId;
        rec.latitude = coords.latitude;
        rec.longitude = coords.longitude;
        rec.recordedAt = Date.now();
        rec.localSyncStatus = SYNC_PENDING;
        rec.syncError = '';
      });
    });
    synchronize().catch(() => {});
  }, PING_INTERVAL_MS);
}

export function stopTracking(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
