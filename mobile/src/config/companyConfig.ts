import AsyncStorage from '@react-native-async-storage/async-storage';

export type CompanyConfig = {
  legalName: string;
  displayName: string;
  upiVpa: string;
};

const STORAGE_KEY = 'company_config';

/**
 * Cached locally after every sync pull (see sync/synchronize.ts) so
 * SpotBillingScreen can build a §18 UPI QR entirely offline at the point
 * of sale — no network round trip needed for the one screen where a
 * customer is standing there waiting to pay.
 */
export async function saveCompanyConfig(config: CompanyConfig): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function getCompanyConfig(): Promise<CompanyConfig | null> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
}
