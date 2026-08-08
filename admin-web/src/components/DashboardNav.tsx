"use client";

import Link from "next/link";
import { useTranslation } from "@/i18n/LanguageContext";

const LINK_CLASS =
  "text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400";

export default function DashboardNav() {
  const { t } = useTranslation();

  return (
    <nav className="flex gap-6 text-sm">
      <Link href="/dashboard" className={LINK_CLASS}>
        {t.nav.dashboard}
      </Link>
      <Link href="/live-map" className={LINK_CLASS}>
        {t.nav.liveMap}
      </Link>
      <Link href="/fleet" className={LINK_CLASS}>
        {t.nav.fleet}
      </Link>
      <Link href="/master-data" className={LINK_CLASS}>
        {t.nav.masterData}
      </Link>
      <Link href="/approvals" className={LINK_CLASS}>
        {t.nav.approvals}
      </Link>
      <Link href="/reports" className={LINK_CLASS}>
        {t.nav.reports}
      </Link>
      <Link href="/targets" className={LINK_CLASS}>
        {t.nav.targets}
      </Link>
      <Link href="/users" className={LINK_CLASS}>
        {t.nav.users}
      </Link>
      <Link href="/roles" className={LINK_CLASS}>
        {t.nav.roles}
      </Link>
      <Link href="/notifications" className={LINK_CLASS}>
        {t.nav.notifications}
      </Link>
      <Link href="/payments" className={LINK_CLASS}>
        {t.nav.payments}
      </Link>
    </nav>
  );
}
