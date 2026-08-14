import type { HTMLAttributes } from "react";

/**
 * The dashboard's card shell, previously copy-pasted as a literal class
 * string in ~30 places. Exported both as a component (for new code) and
 * as CARD_CLASS (existing call sites reference the constant inside their
 * className template so a shell change — radius, border, surface — is a
 * one-file edit without restructuring their JSX).
 */
export const CARD_CLASS =
  "rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900";

export default function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`${CARD_CLASS} ${className}`.trim()} {...props} />;
}
