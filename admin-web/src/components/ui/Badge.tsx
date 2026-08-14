import type { ReactNode } from "react";

/**
 * The one place status-pill styling lives — the bg-X-100/text-X-800
 * (+dark) recipe was previously copy-pasted across two local StatusBadge
 * components and three inline ternaries. Pages keep their own domain
 * mapping (which *status* means which *tone*); only the color recipe is
 * centralized here, so a palette change is a one-file edit.
 */
export const BADGE_TONES = {
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  warning: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  danger: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  neutral: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export default function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}
