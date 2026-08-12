"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/i18n/LanguageContext";
import type { Dictionary } from "@/i18n/locales";

type IconName =
  | "dashboard"
  | "liveMap"
  | "fleet"
  | "masterData"
  | "masterSettings"
  | "importExport"
  | "approvals"
  | "reports"
  | "alerts"
  | "targets"
  | "users"
  | "roles"
  | "notifications"
  | "payments";

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  liveMap: (
    <>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.25" />
    </>
  ),
  fleet: (
    <>
      <rect x="3" y="7" width="11" height="9" rx="1.2" />
      <path d="M14 10.5h3.5L21 14v2h-7z" />
      <circle cx="7.5" cy="18" r="1.75" />
      <circle cx="17" cy="18" r="1.75" />
    </>
  ),
  masterData: (
    <>
      <ellipse cx="12" cy="5.5" rx="7" ry="2.5" />
      <path d="M5 5.5v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6" />
      <path d="M5 11.5v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6" />
    </>
  ),
  masterSettings: (
    <>
      <path d="M4 6h4M12 6h8M4 12h10M18 12h2M4 18h6M14 18h6" />
      <circle cx="10" cy="6" r="2" />
      <circle cx="16" cy="12" r="2" />
      <circle cx="12" cy="18" r="2" />
    </>
  ),
  approvals: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.4 12.4l2.4 2.4 5-5.2" />
    </>
  ),
  importExport: (
    <>
      <path d="M8 3v9.5M8 3L4.5 6.5M8 3l3.5 3.5" />
      <path d="M16 21v-9.5M16 21l3.5-3.5M16 21l-3.5-3.5" />
    </>
  ),
  reports: (
    <>
      <rect x="4" y="10.5" width="3.4" height="9.5" rx="0.8" />
      <rect x="10.3" y="4" width="3.4" height="16" rx="0.8" />
      <rect x="16.6" y="13.5" width="3.4" height="6.5" rx="0.8" />
    </>
  ),
  targets: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.75" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
    </>
  ),
  alerts: (
    <>
      <path d="M12 3.5 21 19H3L12 3.5Z" />
      <path d="M12 9.75v4" />
      <circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.25 20c0-3.6 2.6-6 5.75-6s5.75 2.4 5.75 6" />
      <circle cx="17.5" cy="9" r="2.5" />
      <path d="M15.2 14.3c2.5.5 4.3 2.5 4.3 5.7" />
    </>
  ),
  roles: (
    <>
      <path d="M12 3.2l6.8 2.7v5.4c0 4.7-2.9 7.9-6.8 8.8-3.9-.9-6.8-4.1-6.8-8.8V5.9L12 3.2Z" />
      <path d="M8.9 12.1l2.1 2.1 4.1-4.3" />
    </>
  ),
  notifications: (
    <>
      <path d="M6 10.2a6 6 0 1 1 12 0c0 3.9 1.4 5.4 1.4 5.4H4.6S6 14.1 6 10.2Z" />
      <path d="M9.6 18.4a2.4 2.4 0 0 0 4.8 0" />
    </>
  ),
  payments: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 9.8h18" />
      <path d="M6.5 14.8h4" />
    </>
  ),
};

function NavIcon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

type NavGroup = {
  key: string;
  label: string;
  icon: IconName;
  items: { href: string; label: string; icon: IconName }[];
};

function buildGroups(t: Dictionary): NavGroup[] {
  return [
    {
      key: "overview",
      label: t.nav.groups.overview,
      icon: "dashboard",
      items: [
        { href: "/dashboard", label: t.nav.dashboard, icon: "dashboard" },
        { href: "/live-map", label: t.nav.liveMap, icon: "liveMap" },
      ],
    },
    {
      key: "fleetSync",
      label: t.nav.groups.fleetSync,
      icon: "fleet",
      items: [
        { href: "/fleet", label: t.nav.fleet, icon: "fleet" },
        { href: "/approvals", label: t.nav.approvals, icon: "approvals" },
      ],
    },
    {
      key: "master",
      label: t.nav.groups.master,
      icon: "masterSettings",
      items: [
        { href: "/master-data", label: t.nav.masterData, icon: "masterData" },
        { href: "/master-settings", label: t.nav.masterSettings, icon: "masterSettings" },
        { href: "/import-export", label: t.nav.importExport, icon: "importExport" },
      ],
    },
    {
      key: "insights",
      label: t.nav.groups.insights,
      icon: "reports",
      items: [
        { href: "/reports", label: t.nav.reports, icon: "reports" },
        { href: "/alerts", label: t.nav.alerts, icon: "alerts" },
        { href: "/targets", label: t.nav.targets, icon: "targets" },
      ],
    },
    {
      key: "access",
      label: t.nav.groups.access,
      icon: "users",
      items: [
        { href: "/users", label: t.nav.users, icon: "users" },
        { href: "/roles", label: t.nav.roles, icon: "roles" },
      ],
    },
    {
      key: "alertsPayments",
      label: t.nav.groups.alertsPayments,
      icon: "notifications",
      items: [
        { href: "/notifications", label: t.nav.notifications, icon: "notifications" },
        { href: "/payments", label: t.nav.payments, icon: "payments" },
      ],
    },
  ];
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function subLinkClass(active: boolean) {
  return [
    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
    active
      ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
      : "text-neutral-600 hover:bg-neutral-100 hover:text-amber-600 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-amber-400",
  ].join(" ");
}

export default function DashboardNav() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const groups = buildGroups(t);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const rowRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpenKey(null);
  }, [pathname]);

  useEffect(() => {
    function onDocMouseDown(event: MouseEvent) {
      if (rowRef.current && !rowRef.current.contains(event.target as Node)) {
        setOpenKey(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenKey(null);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <>
      {/* Row layout: major menu buttons that open a sub-menu dropdown */}
      <nav ref={rowRef} className="relative flex flex-wrap items-center gap-1 text-sm nav-col:hidden">
        {groups.map((group) => {
          const groupActive = group.items.some((item) => isActive(pathname, item.href));
          const open = openKey === group.key;
          return (
            <div key={group.key} className="relative">
              <button
                type="button"
                onClick={() => setOpenKey((k) => (k === group.key ? null : group.key))}
                className={[
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors",
                  open || groupActive
                    ? "bg-neutral-100 text-amber-600 dark:bg-neutral-800 dark:text-amber-400"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-amber-600 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-amber-400",
                ].join(" ")}
                aria-haspopup="menu"
                aria-expanded={open}
              >
                <NavIcon name={group.icon} className="h-4 w-4" />
                {group.label}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-3 w-3 opacity-60 transition-transform ${open ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {open && (
                <div
                  role="menu"
                  className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
                >
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      onClick={() => setOpenKey(null)}
                      className={subLinkClass(isActive(pathname, item.href))}
                    >
                      <NavIcon name={item.icon} className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Column layout: sectioned sidebar, groups always expanded */}
      <nav className="hidden text-sm nav-col:flex nav-col:w-full nav-col:flex-col nav-col:gap-4">
        {groups.map((group) => (
          <div key={group.key}>
            <div className="flex items-center gap-2 px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              <NavIcon name={group.icon} className="h-3.5 w-3.5" />
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} className={subLinkClass(isActive(pathname, item.href))}>
                  <NavIcon name={item.icon} className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}
