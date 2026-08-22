import { apiGet } from "@/lib/api";
import BrandLogo from "@/components/BrandLogo";
import DashboardNav from "@/components/DashboardNav";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import LogoutButton from "@/components/LogoutButton";
import NavLayoutToggle from "@/components/NavLayoutToggle";
import ThemeToggle from "@/components/ThemeToggle";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Drives DashboardNav's permission-based item filtering (currently
  // just Users/Roles/Signup Requests — see the comment in
  // DashboardNav.tsx). Falls back to null ("show everything") rather
  // than failing the whole layout if this one call errors, since a page
  // that actually needs auth already enforces it itself via its own
  // apiGet call.
  const permissionCodes = await apiGet<{ permission_codes: string[] }>("/api/me/")
    .then((me) => me.permission_codes)
    .catch(() => null);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 nav-col:flex">
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 nav-col:w-64 nav-col:shrink-0 nav-col:border-b-0 nav-col:border-r">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3 nav-col:mx-0 nav-col:h-full nav-col:max-w-none nav-col:flex-col nav-col:items-stretch nav-col:justify-start nav-col:gap-5 nav-col:px-4 nav-col:py-5">
          <div className="flex items-center gap-8 nav-col:w-full nav-col:flex-col nav-col:items-stretch nav-col:gap-4">
            <div className="flex items-center justify-between gap-2">
              <BrandLogo height={24} />
              <NavLayoutToggle />
            </div>
            <DashboardNav permissionCodes={permissionCodes} />
          </div>
          <div className="flex items-center gap-3 nav-col:mt-auto nav-col:w-full nav-col:flex-col nav-col:items-stretch">
            <ThemeToggle />
            <LanguageSwitcher />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8 nav-col:mx-0 nav-col:min-w-0 nav-col:max-w-none nav-col:flex-1">{children}</main>
    </div>
  );
}
