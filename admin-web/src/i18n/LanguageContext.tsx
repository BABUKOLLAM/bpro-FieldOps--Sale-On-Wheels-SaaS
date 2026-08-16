"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Dictionary, Locale, dictionaries } from "./locales";

const STORAGE_KEY = "locale";

type LanguageContextValue = {
  locale: Locale;
  t: Dictionary;
  setLocale: (locale: Locale) => void;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    // SSR-safe hydration read: localStorage doesn't exist during the
    // server render, so the stored locale can only be applied post-mount
    // (one extra render) — the standard pattern for this, which the
    // lint rule can't distinguish from an accidental cascade.
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "ml" || stored === "ta") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocaleState(stored);
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLocaleState(next);
  }, []);

  const value = useMemo(() => ({ locale, t: dictionaries[locale], setLocale }), [locale, setLocale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useTranslation must be used within a LanguageProvider");
  return ctx;
}
