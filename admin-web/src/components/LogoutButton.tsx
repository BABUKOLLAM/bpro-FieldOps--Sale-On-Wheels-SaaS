"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "@/i18n/LanguageContext";

export default function LogoutButton() {
  const router = useRouter();
  const { t } = useTranslation();

  async function handleLogout() {
    await fetch("/api/session/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400"
    >
      {t.common.logout}
    </button>
  );
}
