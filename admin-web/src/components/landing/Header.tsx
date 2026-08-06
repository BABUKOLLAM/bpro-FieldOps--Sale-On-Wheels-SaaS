import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

export default function Header({ authenticated }: { authenticated: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <BrandLogo height={30} />
          <span className="hidden sm:block h-6 w-px bg-slate-300 dark:bg-slate-700" />
          <span className="hidden sm:block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Van Sales
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300 md:flex">
          <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400">
            Features
          </a>
          <a href="#pricing" className="hover:text-indigo-600 dark:hover:text-indigo-400">
            Pricing
          </a>
          <a href="#calculator" className="hover:text-indigo-600 dark:hover:text-indigo-400">
            Calculator
          </a>
        </nav>

        <Link
          href={authenticated ? "/dashboard" : "/login"}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          {authenticated ? "Go to Dashboard" : "Sign In"}
        </Link>
      </div>
    </header>
  );
}
