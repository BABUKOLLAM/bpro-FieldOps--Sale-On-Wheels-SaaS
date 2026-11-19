import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Last known OS "Reduce motion" (iOS) / "Remove animations" (Android)
 * value, shared across components so later mounts know it synchronously.
 * `null` until the first answer arrives.
 */
let known: boolean | null = null;

function query(): Promise<boolean> {
  // Promise.resolve: some hosts (Jest's RN mock, old platforms) return
  // undefined instead of a promise — treat that as "motion allowed".
  return Promise.resolve()
    .then(() => AccessibilityInfo.isReduceMotionEnabled())
    .then((value) => {
      known = value === true;
      return known;
    })
    .catch(() => {
      known = false;
      return false;
    });
}

/** The cached value; `null` while it is still unknown. */
export function reducedMotionIfKnown(): boolean | null {
  return known;
}

/**
 * Follows the OS reduce-motion setting. Until the first answer it reports
 * `true`, so nothing animates on a device that asked for no motion.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(known ?? true);

  useEffect(() => {
    let alive = true;
    query().then((value) => {
      if (alive) {
        setReduced(value);
      }
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value: boolean) => {
        known = value;
        setReduced(value);
      }
    );
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  return reduced;
}

/** Test hook: forget the cached value. */
export function __resetReducedMotionCache() {
  known = null;
}
