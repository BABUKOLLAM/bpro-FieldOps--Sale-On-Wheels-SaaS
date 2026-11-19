# Icons — concept → icon map

All UI icons are [Lucide](https://lucide.dev) (ISC licence), 24×24, stroke 1.75, round caps/joins,
shown in a duotone **chip** (accent tint ~14–16% behind an accent stroke). One concept = one icon
everywhere. Source of truth in code:

- admin-web: `admin-web/src/components/icons/registry.ts` (`lucide-react`), chip/motion CSS in
  `admin-web/src/app/globals.css` (`--ic-*` tokens, light + `.dark`).
- mobile: `mobile/src/theme/icons.ts` (`lucide-react-native` on `react-native-svg`), components in
  `mobile/src/components/IconChip.tsx`.

Backend templates (Django admin, emails, PDFs) are out of scope and keep their own styling.

| Concept | Lucide icon | Accent | Where |
|---|---|---|---|
| Dashboard / overview | `layout-dashboard` | brand (amber) | web nav, page title, landing |
| Live map | `map-pinned` | brand | web nav, page title |
| Visit / route stop | `map-pin` | brand | mobile route stops |
| Route planning | `route` | sales / brand | landing feature, mobile "Today's Route" |
| Fleet / trips | `truck` | fleet (indigo) | web nav, KPI "Active Trips", mobile Start Trip |
| Approvals / credit review | `badge-check` | fleet (nav) / money (KPI) | web nav, KPI "Pending Credit Review", landing |
| Master data | `database` | settings (slate) | web nav, page title |
| Settings | `settings` | settings | web nav group + Master Settings |
| Import / export | `arrow-down-up` | settings | web nav, page title |
| Insights (group) | `chart-column` | insights (violet) | web nav group |
| Reports / downloads | `file-down` | insights | web nav, Reports page, Export CSV |
| Alerts | `bell` | insights (nav) / alerts (group) | web nav |
| Anomaly insights | `activity` | insights | dashboard section header |
| Fraud / exceptions | `shield-alert` | alerts (rose) | dashboard section header, landing |
| Sync failure / warning | `triangle-alert` | alerts | KPI "Sync Failures", mobile sync banner |
| Targets | `target` | insights | web nav, page title |
| People / users | `users` | people (blue) | web nav, page title |
| Roles | `shield-check` | people | web nav, page title |
| Signup requests | `user-plus` | people | web nav, page title |
| Checked in / attendance | `user-check` | people | KPI "Checked In Today", mobile Check In |
| Push notifications | `megaphone` | alerts | web nav, page title |
| Payments (UPI/card) | `credit-card` | alerts (group) | web nav, page title |
| Sales | `trending-up` | sales (emerald) | web nav group, KPI "Today's Sales" |
| Invoices | `receipt` | sales / money | KPI "Invoices Today", Recent Invoices, landing |
| Collections / outstanding | `wallet` | sales (nav) / money (KPI, mobile) | web nav, KPI, mobile Collect Payment |
| Expense | `banknote` | money | mobile Log Expense |
| Orders | `shopping-cart` | sales | web nav, mobile Take Order |
| Returns | `undo-2` | sales | web nav, mobile Record Return |
| Governed changes | `lock` | settings | landing feature |
| Sync | `refresh-cw` | brand | mobile Sync Now, landing Tally sync |
| History | `history` | insights | mobile My History |
| Calendar / date range | `calendar-range` | brand | web date-range filter |
| Language | `languages` | — (neutral) | mobile language pill |
| Sign out | `log-out` | alerts | web header, mobile header |
| Back | `arrow-left` | — | login / signup "Back to home" |
| Remove / close | `x` | — | web role chip remove |
| Done / included | `check`, `circle-check` | brand / success | landing pricing, mobile receipt attached |
| PIN backspace | `delete` | — | mobile PIN pad |
| Expand | `chevron-down` | — | web nav dropdowns |
| Theme | `sun` / `moon` | — | web theme toggle |
| Menu layout | `rows-3` / `columns-3` | — | web nav layout toggle |
| Loading | `loader-circle` (spinning) | context | web date filter, all mobile spinners |

## Accents

| Token | Light (web) | Dark (web + mobile) |
|---|---|---|
| brand | amber-700 `#b45309` | amber-400 `#fbbf24` (mobile: amber-500 `#f59e0b`, the app primary) |
| sales | emerald-700 `#047857` | emerald-400 `#34d399` |
| money | amber-700 `#b45309` | amber-400 `#fbbf24` |
| stock | violet-700 `#6d28d9` | violet-400 `#a78bfa` |
| fleet | indigo-600 `#4f46e5` | indigo-400 `#818cf8` |
| people | blue-600 `#2563eb` | blue-400 `#60a5fa` |
| alerts | rose-600 `#e11d48` | rose-400 `#fb7185` |
| settings | slate-600 `#475569` | slate-400 `#94a3b8` |
| insights | violet-600 `#7c3aed` | violet-400 `#a78bfa` |

Active nav item = filled chip (solid accent, white stroke in light / near-black in dark).

## Motion (subtle)

Hover/focus/press: chip lifts 1.5px with an accent glow, icon scales 1.08 (180 ms ease-out). Active
nav chip pulses once. KPI tiles, landing features and mobile route stops fade + rise 4px, staggered
40 ms per item (capped at 280 ms). Spinners are the only looping animation. With
`prefers-reduced-motion: reduce` (web) or the OS reduce-motion setting (mobile, via
`AccessibilityInfo`), every transition/animation/transform is off, spinners included (shown still).
Guards: `admin-web/unit/icons.spec.ts`, `mobile/__tests__/icons.test.tsx`.
