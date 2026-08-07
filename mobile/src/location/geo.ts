import Geolocation from '@react-native-community/geolocation';

export type Coords = { latitude: number; longitude: number };

/**
 * Best-effort current position — resolves to `null` on any failure
 * (permission denied, timeout, no fix) rather than throwing. Location
 * capture must never block a trip/checkpoint/billing action from
 * succeeding, the same "never blocks the agent" principle already used
 * for offline credit checks (see apps.sales.services.finalize_invoice).
 */
export function getCurrentLocation(timeoutMs = 8000): Promise<Coords | null> {
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}
