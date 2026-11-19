/**
 * The one concept -> icon map for the admin console (icon refresh, Nov
 * 2026). Every icon in the UI is picked from here by *meaning*, so one
 * concept always draws the same glyph wherever it appears (nav, page
 * title, KPI tile, button). The human-readable table lives in
 * docs/ICONS.md — keep the two in step.
 *
 * Icons: Lucide (https://lucide.dev), ISC licence — see
 * src/components/icons/LICENSE-lucide.txt. Bundled through the
 * `lucide-react` package (tree-shaken: only the icons imported below
 * ship), so there is no CDN or runtime fetch.
 */
import {
  ArrowDownUp,
  ArrowLeft,
  BadgeCheck,
  Bell,
  CalendarRange,
  ChartColumn,
  Check,
  ChevronDown,
  Columns3,
  CreditCard,
  Database,
  FileDown,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MapPinned,
  Megaphone,
  Moon,
  Receipt,
  RefreshCw,
  Rows3,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Sun,
  Target,
  TrendingUp,
  TriangleAlert,
  Truck,
  Undo2,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
  Activity,
  Lock,
  Route,
  type LucideIcon,
} from "lucide-react";

export const ICONS = {
  // Navigation / pages
  dashboard: LayoutDashboard,
  liveMap: MapPinned,
  fleet: Truck,
  approvals: BadgeCheck,
  masterData: Database,
  settings: Settings,
  importExport: ArrowDownUp,
  insights: ChartColumn,
  reports: FileDown,
  alerts: Bell,
  targets: Target,
  users: Users,
  roles: ShieldCheck,
  signupRequests: UserPlus,
  notifications: Megaphone,
  payments: CreditCard,
  collections: Wallet,
  orders: ShoppingCart,
  returns: Undo2,
  // KPI tiles / section headers
  sales: TrendingUp,
  invoices: Receipt,
  checkedIn: UserCheck,
  syncFailure: TriangleAlert,
  anomaly: Activity,
  fraud: ShieldAlert,
  governed: Lock,
  route: Route,
  // Chrome / actions
  calendar: CalendarRange,
  download: FileDown,
  sync: RefreshCw,
  signOut: LogOut,
  back: ArrowLeft,
  close: X,
  check: Check,
  chevronDown: ChevronDown,
  loading: LoaderCircle,
  themeLight: Sun,
  themeDark: Moon,
  layoutRows: Rows3,
  layoutColumns: Columns3,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/**
 * Accent families. Each maps to a `--ic-<accent>` custom property in
 * globals.css (light + .dark values), derived from the console's
 * Yellow & Gray brand (amber) plus the status hues already used by
 * Badge/Button (emerald, red, sky).
 */
export const ACCENTS = [
  "brand",
  "sales",
  "money",
  "stock",
  "fleet",
  "people",
  "alerts",
  "settings",
  "insights",
] as const;

export type Accent = (typeof ACCENTS)[number];
