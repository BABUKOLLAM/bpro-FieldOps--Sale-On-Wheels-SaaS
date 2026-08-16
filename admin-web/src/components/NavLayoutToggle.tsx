"use client";

import { useEffect, useState } from "react";

export default function NavLayoutToggle() {
  const [isColumn, setIsColumn] = useState<boolean | null>(null);

  useEffect(() => {
    // SSR-safe hydration read: the attribute is set pre-hydration by the
    // chrome-init script in layout.tsx, and the server render can't know
    // it — reading it post-mount (one extra render) is the standard
    // pattern for this, which the lint rule can't distinguish.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsColumn(document.documentElement.getAttribute("data-nav-layout") === "column");
  }, []);

  function toggle() {
    const next = document.documentElement.getAttribute("data-nav-layout") !== "column";
    document.documentElement.setAttribute("data-nav-layout", next ? "column" : "row");
    localStorage.setItem("navLayout", next ? "column" : "row");
    setIsColumn(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={isColumn ? "Switch menu to top row" : "Switch menu to side column"}
      aria-label={isColumn ? "Switch menu to top row" : "Switch menu to side column"}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 hover:text-amber-600 dark:hover:bg-neutral-800 dark:hover:text-amber-400"
    >
      {isColumn === null ? null : isColumn ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
          <rect x="3" y="4" width="18" height="4.5" rx="1" />
          <rect x="3" y="10.75" width="18" height="4.5" rx="1" />
          <rect x="3" y="17.5" width="18" height="4.5" rx="1" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
          <rect x="3" y="3" width="4.5" height="18" rx="1" />
          <rect x="9.75" y="3" width="4.5" height="18" rx="1" />
          <rect x="16.5" y="3" width="4.5" height="18" rx="1" />
        </svg>
      )}
    </button>
  );
}
