"use client";

import { useTranslation } from "@/i18n/LanguageContext";
import { LOCALE_LABELS, type Locale } from "@/i18n/locales";

const LOCALE_ORDER: Locale[] = ["en", "hi", "ml", "ta"];

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      aria-label="Language"
      className="h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-transparent px-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
    >
      {LOCALE_ORDER.map((code) => (
        <option key={code} value={code} className="text-slate-900">
          {LOCALE_LABELS[code]}
        </option>
      ))}
    </select>
  );
}
