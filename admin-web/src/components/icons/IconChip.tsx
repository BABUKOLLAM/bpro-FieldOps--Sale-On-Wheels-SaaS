import { ICONS, type Accent, type IconName } from "./registry";

const CHIP_SIZES = {
  xs: "ic-chip--xs",
  sm: "ic-chip--sm",
  md: "ic-chip--md",
  lg: "ic-chip--lg",
} as const;

/** A bare Lucide icon from the registry — decorative, so hidden from AT. */
export function Icon({
  name,
  className = "h-4 w-4",
  spin = false,
}: {
  name: IconName;
  className?: string;
  spin?: boolean;
}) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      aria-hidden="true"
      focusable="false"
      strokeWidth={1.75}
      className={`${className}${spin ? " ic-spin" : ""}`}
      data-icon={name}
    />
  );
}

/**
 * Duotone icon chip: accent-tinted tile with the stroke in the accent.
 * `active` renders the filled variant (solid accent, contrasting stroke)
 * and plays the one-shot pulse. Hover/focus lift is driven by the nearest
 * ancestor carrying the `ic-host` class (a link, button or card), so the
 * whole control — not just the tiny tile — triggers it. Server-safe (no
 * hooks), so pages can use it directly.
 */
export default function IconChip({
  name,
  accent = "brand",
  size = "sm",
  active = false,
  disabled = false,
  className = "",
}: {
  name: IconName;
  accent?: Accent;
  size?: keyof typeof CHIP_SIZES;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const Glyph = ICONS[name];
  return (
    <span
      aria-hidden="true"
      data-accent={accent}
      data-active={active ? "true" : undefined}
      data-disabled={disabled ? "true" : undefined}
      className={`ic-chip ${CHIP_SIZES[size]} ${className}`.trim()}
    >
      <Glyph strokeWidth={1.75} focusable="false" data-icon={name} />
    </span>
  );
}
