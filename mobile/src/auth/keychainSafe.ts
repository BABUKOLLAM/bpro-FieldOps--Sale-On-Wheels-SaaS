/**
 * Runs a Keychain call and falls back on rejection instead of leaving the
 * caller's async init effect to throw — a Keychain read/write can reject
 * for reasons other than "no entry" (e.g. iOS before-first-unlock state),
 * and an unhandled rejection here would otherwise hang whatever `isLoading`
 * flag depends on it forever.
 */
export async function safeKeychainCall<T>(
  fn: () => Promise<T>,
  fallback: T | (() => Promise<T>)
): Promise<T> {
  try {
    return await fn();
  } catch {
    return typeof fallback === 'function'
      ? await (fallback as () => Promise<T>)()
      : fallback;
  }
}
