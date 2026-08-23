"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import { useTranslation } from "@/i18n/LanguageContext";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  // Prefilled only in local dev — this must never reach a real client's
  // production login page (see the demo-credentials hint below).
  const [username, setUsername] = useState(
    process.env.NODE_ENV === "production" ? "" : "tech@bpropms.com"
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Invalid credentials.");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-neutral-50 dark:bg-neutral-950">
      <div
        className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-25"
        style={{
          background:
            "radial-gradient(600px circle at 15% -10%, rgba(217,119,6,0.22), transparent 60%), radial-gradient(500px circle at 90% 10%, rgba(115,115,115,0.18), transparent 55%)",
        }}
      />

      <div className="absolute right-4 top-4 flex items-center gap-2">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-10">
        <Link href="/" className="mb-8 flex flex-col items-center gap-3">
          <BrandLogo height={40} />
          <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{t.login.backToHome}</span>
        </Link>

        <div className="w-full max-w-sm rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 shadow-lg shadow-neutral-900/5">
          <h1 className="font-[family-name:var(--font-archivo)] text-xl font-bold text-neutral-900 dark:text-neutral-50">
            {t.login.heading}
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{t.login.subheading}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.login.username}</label>
              <input
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.login.password}</label>
                <Link href="/forgot-password" className="text-xs font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {error && (
              <p className="rounded-md bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-amber-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-amber-400 disabled:opacity-60"
            >
              {loading ? t.login.signingIn : t.login.signIn}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
            Need an account?{" "}
            <Link href="/signup" className="font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400">
              Request access
            </Link>
          </p>

          {process.env.NODE_ENV !== "production" && (
            <p className="mt-4 text-xs text-neutral-400">
              Admin: tech@bpropms.com / Bpro#1234
            </p>
          )}
        </div>
      </div>

      <footer className="relative flex items-center justify-center gap-2.5 pb-8 text-xs text-neutral-500 dark:text-neutral-400">
        <span>Designed &amp; developed by</span>
        <span className="inline-flex items-center gap-2">
          <BrandLogo height={18} />
          <span className="font-medium text-neutral-600 dark:text-neutral-300">Team bpro Technologies &amp; Consulting</span>
        </span>
      </footer>
    </div>
  );
}
