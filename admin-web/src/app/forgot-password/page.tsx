"use client";

import { useState } from "react";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/session/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier }),
      });
      // The backend always returns the same generic response here on
      // purpose (see PasswordResetRequestView) — a distinct "not found"
      // message would let anyone probe which emails have accounts.
      if (!response.ok) throw new Error("Something went wrong. Please try again.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
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

      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-10">
        <Link href="/" className="mb-8 flex flex-col items-center gap-3">
          <BrandLogo height={40} />
        </Link>

        <div className="w-full max-w-sm rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 shadow-lg shadow-neutral-900/5">
          <h1 className="font-[family-name:var(--font-archivo)] text-xl font-bold text-neutral-900 dark:text-neutral-50">
            Reset your password
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Enter your email or username and we&apos;ll send you a link to set a new password.
          </p>

          {done ? (
            <p className="mt-6 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              If that account exists, a password reset link has been sent to its email address.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Email or username
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
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
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
            <Link href="/login" className="font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
