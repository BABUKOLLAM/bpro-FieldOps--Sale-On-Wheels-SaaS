import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

export default function Footer() {
  return (
    <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="text-center sm:text-left">
            <p className="font-[family-name:var(--font-archivo)] text-sm font-bold text-neutral-900 dark:text-white">bpro FieldOps</p>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Field sales &amp; fleet management, built for Indian distributors.
            </p>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-neutral-600 dark:text-neutral-300">
            <a href="#features" className="hover:text-amber-600 dark:hover:text-amber-400">Features</a>
            <a href="#pricing" className="hover:text-amber-600 dark:hover:text-amber-400">Pricing</a>
            <a href="mailto:tech@bpropms.com" className="hover:text-amber-600 dark:hover:text-amber-400">
              Contact
            </a>
            <Link href="/login" className="hover:text-amber-600 dark:hover:text-amber-400">Sign In</Link>
          </nav>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-neutral-200 dark:border-neutral-800 pt-6 sm:flex-row">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            &copy; {new Date().getFullYear()} bpro FieldOps. All rights reserved.
          </p>
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Designed &amp; developed by</span>
            <a href="mailto:tech@bpropms.com" aria-label="Team bpro Technologies & Consulting">
              <BrandLogo height={22} />
            </a>
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
              Team bpro Technologies &amp; Consulting
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
