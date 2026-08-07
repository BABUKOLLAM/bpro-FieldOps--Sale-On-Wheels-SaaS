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
      const existing = await Keychain.getGenericPassword({
        service: PIN_KEYCHAIN_SERVICE,
      });
      setHasPinSet(Boolean(existing));
      setBiometryType(await Keychain.getSupportedBiometryType());
      setIsLoading(false);
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
        authenticationPrompt: { title: 'Unlock Van Sales' },
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
