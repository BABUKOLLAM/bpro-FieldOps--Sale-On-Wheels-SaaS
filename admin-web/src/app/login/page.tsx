"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin@demo.local");
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
    <div className="relative flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <div
        className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-25"
        style={{
          background:
            "radial-gradient(600px circle at 15% -10%, rgba(99,102,241,0.25), transparent 60%), radial-gradient(500px circle at 90% 10%, rgba(99,102,241,0.18), transparent 55%)",
        }}
      />

      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-10">
        <Link href="/" className="mb-8 flex flex-col items-center gap-3">
          <BrandLogo height={40} />
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">← Back to Van Sales home</span>
        </Link>

        <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-lg shadow-slate-900/5">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Sign in to Van Sales</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Access the back-office console for field, fleet &amp; finance.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Username</label>
              <input
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-xs text-slate-400">
            Demo: admin@demo.local / DemoPass123! (after running seed_demo_data)
          </p>
        </div>
      </div>

      <footer className="relative flex items-center justify-center gap-2.5 pb-8 text-xs text-slate-500 dark:text-slate-400">
        <span>Designed &amp; developed by</span>
        <span className="inline-flex items-center gap-2">
          <BrandLogo height={18} />
          <span className="font-medium text-slate-600 dark:text-slate-300">Team bpro Technologies &amp; Consulting</span>
        </span>
      </footer>
    </div>
  );
}
