/**
 * Device cache housekeeping for "My history", kept free of database/sync
 * imports so AuthContext can call it on sign-out cheaply.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CACHE_PREFIX = 'vansales.history.';

/** Remove every cached history entry on this device (called on sign-out,
 * so the next user of a shared phone never sees them). */
export async function clearHistoryCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (ours.length) {
      await AsyncStorage.multiRemove(ours);
    }
  } catch {
    // Best effort — sign-out must never fail because of the cache.
  }
}
