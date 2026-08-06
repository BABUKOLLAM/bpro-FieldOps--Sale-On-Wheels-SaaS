import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="text-center sm:text-left">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Van Sales</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Field sales &amp; fleet management, built for Indian distributors.
            </p>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400">Features</a>
            <a href="#pricing" className="hover:text-indigo-600 dark:hover:text-indigo-400">Pricing</a>
            <a href="mailto:tech@bpropms.com" className="hover:text-indigo-600 dark:hover:text-indigo-400">
              Contact
            </a>
            <Link href="/login" className="hover:text-indigo-600 dark:hover:text-indigo-400">Sign In</Link>
          </nav>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800 pt-6 sm:flex-row">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            &copy; {new Date().getFullYear()} Van Sales. All rights reserved.
          </p>
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">Designed &amp; developed by</span>
            <a href="mailto:tech@bpropms.com" aria-label="Team bpro Technologies & Consulting">
              <BrandLogo height={22} />
            </a>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Team bpro Technologies &amp; Consulting
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
