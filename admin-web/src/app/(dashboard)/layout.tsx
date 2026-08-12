import BrandLogo from "@/components/BrandLogo";
import DashboardNav from "@/components/DashboardNav";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import LogoutButton from "@/components/LogoutButton";
import NavLayoutToggle from "@/components/NavLayoutToggle";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 nav-col:flex">
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 nav-col:w-64 nav-col:shrink-0 nav-col:border-b-0 nav-col:border-r">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3 nav-col:mx-0 nav-col:h-full nav-col:max-w-none nav-col:flex-col nav-col:items-stretch nav-col:justify-start nav-col:gap-5 nav-col:px-4 nav-col:py-5">
          <div className="flex items-center gap-8 nav-col:w-full nav-col:flex-col nav-col:items-stretch nav-col:gap-4">
            <div className="flex items-center justify-between gap-2">
              <BrandLogo height={24} />
              <NavLayoutToggle />
            </div>
            <DashboardNav />
          </div>
          <div className="flex items-center gap-3 nav-col:mt-auto nav-col:w-full nav-col:flex-col nav-col:items-stretch">
            <LanguageSwitcher />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8 nav-col:mx-0 nav-col:min-w-0 nav-col:max-w-none nav-col:flex-1">{children}</main>
    </div>
  );
}
