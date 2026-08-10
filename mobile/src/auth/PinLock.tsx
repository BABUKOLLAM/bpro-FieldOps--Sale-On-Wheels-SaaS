import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as Keychain from 'react-native-keychain';

/**
 * Device-level PIN lock — independent of, and layered on top of, server
 * JWT auth (see docs/architecture.md "Auth & RBAC"). Gates access to the
 * app itself and to retrieving the JWT refresh token from Keychain, per
 * the BRD's device PIN/biometric NFR. Biometric unlock, where available,
 * is offered as a convenience on top of the same underlying PIN.
 */
const PIN_KEYCHAIN_SERVICE = 'vansales.devicepin';

type PinContextValue = {
  isLoading: boolean;
  hasPinSet: boolean;
  isUnlocked: boolean;
  setPin: (pin: string) => Promise<void>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  lock: () => void;
  biometryType: Keychain.BIOMETRY_TYPE | null;
};

const PinContext = createContext<PinContextValue | undefined>(undefined);

export function PinProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasPinSet, setHasPinSet] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [biometryType, setBiometryType] =
    useState<Keychain.BIOMETRY_TYPE | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const existing = await Keychain.getGenericPassword({
          service: PIN_KEYCHAIN_SERVICE,
        });
        setHasPinSet(Boolean(existing));
        try {
          setBiometryType(await Keychain.getSupportedBiometryType());
        } catch {
          // Biometry probe can reject (e.g. no biometry enrolled/configured
          // on this device) — PIN entry still works without it.
          setBiometryType(null);
        }
      } catch {
        // Keychain read failed — fall through with no PIN set so the setup
        // screen shows, rather than leaving isLoading stuck true forever.
        setHasPinSet(false);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setPin = useCallback(async (pin: string) => {
    await Keychain.setGenericPassword('device-pin', pin, {
      service: PIN_KEYCHAIN_SERVICE,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
    });
    setHasPinSet(true);
    setIsUnlocked(true);
  }, []);

  const unlockWithPin = useCallback(async (pin: string) => {
    const stored = await Keychain.getGenericPassword({
      service: PIN_KEYCHAIN_SERVICE,
    });
    const ok = stored !== false && stored.password === pin;
    if (ok) {
      setIsUnlocked(true);
    }
    return ok;
  }, []);

  const unlockWithBiometrics = useCallback(async () => {
    try {
      const stored = await Keychain.getGenericPassword({
        service: PIN_KEYCHAIN_SERVICE,
        authenticationPrompt: { title: 'Unlock bpro FieldOps' },
      });
      if (stored) {
        setIsUnlocked(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const lock = useCallback(() => setIsUnlocked(false), []);

  const value = useMemo(
    () => ({
      isLoading,
      hasPinSet,
      isUnlocked,
      setPin,
      unlockWithPin,
      unlockWithBiometrics,
      lock,
      biometryType,
    }),
    [
      isLoading,
      hasPinSet,
      isUnlocked,
      setPin,
      unlockWithPin,
      unlockWithBiometrics,
      lock,
      biometryType,
    ]
  );

  return <PinContext.Provider value={value}>{children}</PinContext.Provider>;
}

export function usePinLock(): PinContextValue {
  const ctx = useContext(PinContext);
  if (!ctx) {
    throw new Error('usePinLock must be used within a PinProvider');
  }
  return ctx;
}
