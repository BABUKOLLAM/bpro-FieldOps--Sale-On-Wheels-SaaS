import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import ThemeToggle from "@/components/ThemeToggle";

export default function Header({ authenticated }: { authenticated: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/80 dark:bg-neutral-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <BrandLogo height={30} />
          <span className="hidden sm:block h-6 w-px bg-neutral-300 dark:bg-neutral-700" />
          <span className="hidden sm:block font-[family-name:var(--font-archivo)] text-sm font-bold tracking-tight text-neutral-800 dark:text-neutral-100">
            Van Sales
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-neutral-600 dark:text-neutral-300 md:flex">
          <a href="#features" className="hover:text-amber-600 dark:hover:text-amber-400">
            Features
          </a>
          <a href="#pricing" className="hover:text-amber-600 dark:hover:text-amber-400">
            Pricing
          </a>
          <a href="#calculator" className="hover:text-amber-600 dark:hover:text-amber-400">
            Calculator
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href={authenticated ? "/dashboard" : "/login"}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-amber-400"
          >
            {authenticated ? "Go to Dashboard" : "Sign In"}
          </Link>
        </div>
      </div>
    </header>
  );
}
