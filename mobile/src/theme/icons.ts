/**
 * The one concept -> icon map for the mobile app (icon refresh, Nov
 * 2026). Pick icons by *meaning* from here so a concept always draws the
 * same glyph; the human-readable table is docs/ICONS.md at the repo root
 * (shared with admin-web — keep them in step).
 *
 * Icons: Lucide (https://lucide.dev), ISC licence — see
 * src/components/LICENSE-lucide.txt. Rendered through lucide-react-native
 * on the react-native-svg the app already ships (no CDN, works offline).
 */
import {
  Banknote,
  CircleCheck,
  Delete,
  History,
  Languages,
  LoaderCircle,
  LogOut,
  MapPin,
  RefreshCw,
  Route,
  ShoppingCart,
  TriangleAlert,
  Truck,
  Undo2,
  UserCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';

export const ICONS = {
  checkedIn: UserCheck,
  fleet: Truck,
  expense: Banknote,
  collections: Wallet,
  orders: ShoppingCart,
  returns: Undo2,
  sync: RefreshCw,
  history: History,
  signOut: LogOut,
  language: Languages,
  syncFailure: TriangleAlert,
  route: Route,
  visit: MapPin,
  backspace: Delete,
  done: CircleCheck,
  loading: LoaderCircle,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/**
 * Accent strokes for the app's dark palette (colors.ts). 400-level hues
 * so the stroke clears 3:1 against its own 16% tint on #0a0a0a/#171717;
 * brand stays the app's amber primary.
 */
export const ACCENTS = {
  brand: '#f59e0b',
  sales: '#34d399',
  money: '#fbbf24',
  stock: '#a78bfa',
  fleet: '#818cf8',
  people: '#60a5fa',
  alerts: '#fb7185',
  settings: '#94a3b8',
  insights: '#a78bfa',
} as const;

export type Accent = keyof typeof ACCENTS;

/** Stroke drawn on a filled (active) chip — dark, like colors.onPrimary. */
export const ICON_ON_FILLED = '#0a0a0a';

/** `#rrggbb` + alpha (0..1) -> `rgba(...)` for the chip tint. */
export function tint(hex: string, alpha: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Tile entrance stagger: 40ms per item, capped so the last starts by 280ms. */
export function staggerDelay(index: number): number {
  return Math.min(Math.max(index, 0), 7) * 40;
}
