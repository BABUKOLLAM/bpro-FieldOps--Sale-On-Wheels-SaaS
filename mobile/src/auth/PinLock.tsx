import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as Keychain from 'react-native-keychain';
import { safeKeychainCall } from './keychainSafe';

/**
 * Device-level PIN lock — independent of, and layered on top of, server
 * JWT auth (see docs/architecture.md "Auth & RBAC"). Gates access to the
 * app itself and to retrieving the JWT refresh token from Keychain, per
 * the BRD's device PIN/biometric NFR. Biometric unlock, where available,
 * is offered as a convenience on top of the same underlying PIN.
 */
const PIN_KEYCHAIN_SERVICE = 'vansales.devicepin';
// Plaintext, non-sensitive marker recording whether the entry above was
// actually stored behind Keychain access control (setPin's fallback can
// store it without any — see setPin). Read back on every launch so the
// biometric-unlock button is only ever offered when it's backed by a real
// OS-level check, not silently no-op against an unprotected entry.
const PIN_PROTECTION_META_SERVICE = 'vansales.devicepin.meta';
const PROTECTED = 'protected';
const UNPROTECTED = 'unprotected';

type PinContextValue = {
  isLoading: boolean;
  hasPinSet: boolean;
  isUnlocked: boolean;
  initError: boolean;
  retryInit: () => void;
  pinProtected: boolean;
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
  const [initError, setInitError] = useState(false);
  const [pinProtected, setPinProtected] = useState(false);
  const [biometryType, setBiometryType] =
    useState<Keychain.BIOMETRY_TYPE | null>(null);

  const loadPinState = useCallback(async () => {
    setIsLoading(true);
    setInitError(false);

    // Independent reads — neither depends on the other's result — run
    // concurrently via allSettled so one rejecting doesn't skip the other
    // (previously nested try/catches meant an outer failure silently
    // skipped the biometry probe for the rest of the app session).
    const [existingResult, biometryResult] = await Promise.allSettled([
      Keychain.getGenericPassword({ service: PIN_KEYCHAIN_SERVICE }),
      Keychain.getSupportedBiometryType(),
    ]);

    if (existingResult.status === 'fulfilled') {
      setHasPinSet(Boolean(existingResult.value));
    } else {
      // A rejection here is NOT the same as "no PIN was ever set" — e.g.
      // iOS rejects reads of passcode/biometry-gated Keychain items before
      // first unlock. Treating it as "no PIN" would silently route the
      // user into the setup flow, where entering any PIN overwrites the
      // real one with no verification. Surface a distinct error instead
      // and let the caller retry rather than guessing.
      setInitError(true);
    }

    setBiometryType(
      biometryResult.status === 'fulfilled' ? biometryResult.value : null
    );

    const meta = await safeKeychainCall(
      () =>
        Keychain.getGenericPassword({ service: PIN_PROTECTION_META_SERVICE }),
      false as const
    );
    setPinProtected(meta !== false && meta.password === PROTECTED);

    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadPinState();
  }, [loadPinState]);

  const retryInit = useCallback(() => {
    loadPinState();
  }, [loadPinState]);

  const setPin = useCallback(async (pin: string) => {
    let protectedWrite = true;
    try {
      await Keychain.setGenericPassword('device-pin', pin, {
        service: PIN_KEYCHAIN_SERVICE,
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
      });
    } catch (err) {
      // The access-control write requires a device passcode or enrolled
      // biometry to be configured — neither is guaranteed (e.g. a fresh
      // simulator, or a real device the owner never set a passcode on).
      // Fall back to plain storage; the app's own PIN gate still protects
      // access either way. Logged rather than swallowed since this
      // permanently weakens Keychain-level protection for this device.
      console.warn(
        'PinLock.setPin: storing device PIN without Keychain access control — protected write failed:',
        err
      );
      protectedWrite = false;
      await Keychain.setGenericPassword('device-pin', pin, {
        service: PIN_KEYCHAIN_SERVICE,
      });
    }
    // Best-effort — a failed meta write only affects whether the biometric
    // button is offered next launch, never PIN correctness itself.
    await safeKeychainCall(
      () =>
        Keychain.setGenericPassword(
          'meta',
          protectedWrite ? PROTECTED : UNPROTECTED,
          { service: PIN_PROTECTION_META_SERVICE }
        ),
      undefined
    );
    setPinProtected(protectedWrite);
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
      initError,
      retryInit,
      pinProtected,
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
      initError,
      retryInit,
      pinProtected,
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
