"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/i18n/LanguageContext";
import type { Dictionary } from "@/i18n/locales";
import IconChip, { Icon } from "@/components/icons/IconChip";
import type { Accent, IconName } from "@/components/icons/registry";

type NavItem = { href: string; label: string; icon: IconName; requiredPermission?: string };

type NavGroup = {
  key: string;
  label: string;
  icon: IconName;
  /** One accent per menu section — every icon in the group shares it. */
  accent: Accent;
  items: NavItem[];
};

/**
 * Nav-level permission gating is deliberately scoped to just these three
 * access-sensitive items for now, not every page in the app — showing a
 * dead "Fleet" or "Reports" link to someone who lacks that permission is
 * a minor annoyance (the page itself still enforces access), but showing
 * "Users"/"Roles"/"Signup Requests" to a non-admin invites confusion
 * about who can actually manage accounts. Extending this to the rest of
 * the nav is a reasonable follow-up once each page's exact required
 * permission is confirmed against its backend viewset one at a time.
 */
function isVisible(item: NavItem, permissionCodes: string[] | null) {
  if (!item.requiredPermission) return true;
  if (permissionCodes === null) return true; // unknown yet — fail open, not closed
  return permissionCodes.includes(item.requiredPermission);
}

function buildGroups(t: Dictionary): NavGroup[] {
  return [
    {
      key: "overview",
      label: t.nav.groups.overview,
      icon: "dashboard",
      accent: "brand",
      items: [
        { href: "/dashboard", label: t.nav.dashboard, icon: "dashboard" },
        { href: "/live-map", label: t.nav.liveMap, icon: "liveMap" },
      ],
    },
    {
      key: "fleetSync",
      label: t.nav.groups.fleetSync,
      icon: "fleet",
      accent: "fleet",
      items: [
        { href: "/fleet", label: t.nav.fleet, icon: "fleet" },
        { href: "/approvals", label: t.nav.approvals, icon: "approvals" },
      ],
    },
    {
      key: "master",
      label: t.nav.groups.master,
      icon: "settings",
      accent: "settings",
      items: [
        { href: "/master-data", label: t.nav.masterData, icon: "masterData" },
        { href: "/master-settings", label: t.nav.masterSettings, icon: "settings" },
        { href: "/import-export", label: t.nav.importExport, icon: "importExport" },
      ],
    },
    {
      key: "insights",
      label: t.nav.groups.insights,
      icon: "insights",
      accent: "insights",
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
      accent: "people",
      items: [
        { href: "/users", label: t.nav.users, icon: "users", requiredPermission: "users.manage" },
        { href: "/roles", label: t.nav.roles, icon: "roles", requiredPermission: "roles.manage" },
        {
          href: "/signup-requests",
          label: t.nav.signupRequests,
          icon: "signupRequests",
          requiredPermission: "users.manage",
        },
      ],
    },
    {
      key: "alertsPayments",
      label: t.nav.groups.alertsPayments,
      icon: "alerts",
      accent: "alerts",
      items: [
        { href: "/notifications", label: t.nav.notifications, icon: "notifications" },
        { href: "/payments", label: t.nav.payments, icon: "payments" },
      ],
    },
    {
      key: "sales",
      label: t.nav.groups.sales,
      icon: "sales",
      accent: "sales",
      items: [
        { href: "/collections", label: t.nav.collections, icon: "collections" },
        { href: "/orders", label: t.nav.orders, icon: "orders" },
        { href: "/returns", label: t.nav.returns, icon: "returns" },
      ],
    },
  ];
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function subLinkClass(active: boolean) {
  return [
    "ic-host flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors",
    active
      ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
      : "text-neutral-600 hover:bg-neutral-100 hover:text-amber-600 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-amber-400",
  ].join(" ");
}

export default function DashboardNav({ permissionCodes = null }: { permissionCodes?: string[] | null }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const groups = buildGroups(t)
    .map((group) => ({ ...group, items: group.items.filter((item) => isVisible(item, permissionCodes)) }))
    .filter((group) => group.items.length > 0);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const rowRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Close any open dropdown on navigation. Deliberately effect-driven:
    // it must react to route changes made from anywhere (including a
    // link inside the open dropdown itself).
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
                  "ic-host flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors",
                  open || groupActive
                    ? "bg-neutral-100 text-amber-600 dark:bg-neutral-800 dark:text-amber-400"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-amber-600 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-amber-400",
                ].join(" ")}
                aria-haspopup="menu"
                aria-expanded={open}
              >
                <IconChip name={group.icon} accent={group.accent} size="xs" active={groupActive} />
                {group.label}
                <Icon
                  name="chevronDown"
                  className={`h-3 w-3 opacity-60 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
                />
              </button>
              {open && (
                <div
                  role="menu"
                  className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
                >
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        role="menuitem"
                        aria-current={active ? "page" : undefined}
                        onClick={() => setOpenKey(null)}
                        className={subLinkClass(active)}
                      >
                        <IconChip name={item.icon} accent={group.accent} size="sm" active={active} />
                        {item.label}
                      </Link>
                    );
                  })}
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
              <span data-accent={group.accent} className="text-[var(--ic)]">
                <Icon name={group.icon} className="h-3.5 w-3.5" />
              </span>
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={subLinkClass(active)}
                  >
                    <IconChip name={item.icon} accent={group.accent} size="sm" active={active} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}
