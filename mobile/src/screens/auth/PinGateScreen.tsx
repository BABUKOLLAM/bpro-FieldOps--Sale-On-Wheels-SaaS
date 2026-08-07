import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePinLock } from '../../auth/PinLock';
import { colors } from '../../theme/colors';

const PIN_LENGTH = 4;

/** Large-touch-target PIN pad — no typing, per the BRD's minimal-training
 * UI requirement. Doubles as setup (first run) and unlock (every
 * subsequent cold start), gating both app access and JWT retrieval.
 * Biometric unlock (offered below the pad once a PIN exists) is a
 * convenience layered on the same underlying secret — see auth/PinLock. */
export default function PinGateScreen() {
  const {
    hasPinSet,
    setPin,
    unlockWithPin,
    unlockWithBiometrics,
    biometryType,
  } = usePinLock();
  const [entry, setEntry] = useState('');
  const [confirmStage, setConfirmStage] = useState(false);
  const [firstEntry, setFirstEntry] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleDigit(digit: string) {
    const next = (entry + digit).slice(0, PIN_LENGTH);
    setEntry(next);
    if (next.length !== PIN_LENGTH) {
      return;
    }

    if (!hasPinSet) {
      if (!confirmStage) {
        setFirstEntry(next);
        setConfirmStage(true);
        setEntry('');
      } else if (next === firstEntry) {
        await setPin(next);
      } else {
        setError('PINs did not match. Try again.');
        setConfirmStage(false);
        setFirstEntry('');
        setEntry('');
      }
    } else {
      const ok = await unlockWithPin(next);
      if (!ok) {
        setError('Incorrect PIN.');
        setEntry('');
      }
    }
  }

  const title = !hasPinSet
    ? confirmStage
      ? 'Confirm your PIN'
      : 'Set a device PIN'
    : 'Enter your PIN';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.dots}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i < entry.length && styles.dotFilled]}
          />
        ))}
      </View>

      <View style={styles.pad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(
          (key, i) => (
            <TouchableOpacity
              key={i}
              style={styles.key}
              disabled={key === ''}
              onPress={() =>
                key === '⌫'
                  ? setEntry(entry.slice(0, -1))
                  : key && handleDigit(key)
              }
            >
              <Text style={styles.keyText}>{key}</Text>
            </TouchableOpacity>
          )
        )}
      </View>

      {hasPinSet && biometryType && (
        <TouchableOpacity
          style={styles.biometricButton}
          onPress={unlockWithBiometrics}
        >
          <Text style={styles.biometricText}>Use {biometryType}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 24,
  },
  error: { color: colors.danger, marginBottom: 12 },
  dots: { flexDirection: 'row', marginBottom: 32 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 8,
  },
  dotFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    justifyContent: 'center',
  },
  key: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 6,
    borderRadius: 40,
    backgroundColor: colors.surface,
  },
  keyText: { color: colors.textPrimary, fontSize: 26, fontWeight: '500' },
  biometricButton: { marginTop: 24 },
  biometricText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
});
