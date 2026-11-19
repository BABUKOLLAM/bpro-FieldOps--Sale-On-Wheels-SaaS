"use client";

import { Icon } from "@/components/icons/IconChip";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    // SSR-safe hydration read: the class is set pre-hydration by the
    // chrome-init script in layout.tsx — see NavLayoutToggle for why
    // this pattern is deliberate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setIsDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="ic-host flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-neutral-800 dark:hover:text-amber-400"
    >
      {isDark === null ? null : (
        <Icon name={isDark ? "themeLight" : "themeDark"} className="ic-glyph h-4.5 w-4.5" />
      )}
    </button>
  );
}
