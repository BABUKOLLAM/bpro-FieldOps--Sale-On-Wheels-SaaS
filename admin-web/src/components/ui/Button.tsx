import type { ButtonHTMLAttributes } from "react";

/**
 * The one place action-button styling lives. Extracted after the Yellow &
 * Gray recolor had to edit 45 files precisely because every form hardcoded
 * its own class string — with this, the next brand change is a one-file
 * edit. Variants map to the console's established semantics:
 *  - primary: brand amber, dark text (amber-600 + white text fails WCAG
 *    contrast — the same trap fixed twice already, on mobile and in the
 *    recolor; keep text-neutral-950 here).
 *  - success: approve/confirm actions (emerald).
 *  - danger: destructive/reject actions (red).
 *  - secondary: neutral outline, e.g. cancel/export.
 */
const VARIANT_CLASSES = {
  primary:
    "bg-amber-600 text-neutral-950 hover:bg-amber-500 disabled:opacity-60",
  success: "bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60",
  danger: "bg-red-600 text-white hover:bg-red-500 disabled:opacity-60",
  secondary:
    "border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-60",
} as const;

const SIZE_CLASSES = {
  sm: "rounded-md px-3 py-1 text-xs font-medium",
  md: "rounded-md px-4 py-1.5 text-sm font-medium",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANT_CLASSES;
  size?: keyof typeof SIZE_CLASSES;
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`.trim()}
      {...props}
    />
  );
}
