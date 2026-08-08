import DashboardNav from "@/components/DashboardNav";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import LogoutButton from "@/components/LogoutButton";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">Van Sales Admin</span>
            <DashboardNav />
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
