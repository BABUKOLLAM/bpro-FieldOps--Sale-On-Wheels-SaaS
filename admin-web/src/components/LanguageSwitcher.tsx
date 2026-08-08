"use client";

import { useTranslation } from "@/i18n/LanguageContext";
import { LOCALE_LABELS } from "@/i18n/locales";

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => setLocale(locale === "en" ? "hi" : "en")}
      aria-label={`Switch to ${LOCALE_LABELS[locale === "en" ? "hi" : "en"]}`}
      className="flex h-9 items-center rounded-md border border-slate-200 dark:border-slate-700 px-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
    >
      {LOCALE_LABELS[locale === "en" ? "hi" : "en"]}
    </button>
  );
}
