"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";

type Lookup = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; username: string; email: string };

function SetPasswordForm() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid") || "";
  const token = searchParams.get("token") || "";

  const [lookup, setLookup] = useState<Lookup>(() =>
    uid && token
      ? { status: "loading" }
      : { status: "error", message: "This link is missing required information. Please use the exact link from your email." }
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!uid || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/session/set-password-lookup?uid=${encodeURIComponent(uid)}&token=${encodeURIComponent(token)}`);
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          setLookup({ status: "error", message: data.detail || "This link is invalid or has expired." });
          return;
        }
        setLookup({ status: "ok", username: data.username, email: data.email });
      } catch {
        if (!cancelled) setLookup({ status: "error", message: "Could not verify this link. Please try again." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, token]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/session/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not set your password.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set your password.");
    } finally {
      setLoading(false);
    }
  }

  if (lookup.status === "loading") {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Verifying your link…</p>;
  }

  if (lookup.status === "error") {
    return (
      <p className="rounded-md bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-600 dark:text-red-400">
        {lookup.message}
      </p>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Your password has been set. You can now sign in.
        </p>
        <Link
          href="/login"
          className="block w-full rounded-md bg-amber-500 px-4 py-2.5 text-center text-sm font-semibold text-neutral-950 hover:bg-amber-400"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Setting a password for</span>
        <p className="mt-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100">
          {lookup.email || lookup.username}
          {lookup.email && lookup.email !== lookup.username && (
            <span className="ml-1 text-neutral-500 dark:text-neutral-400">({lookup.username})</span>
          )}
        </p>
      </div>
      <div>
        <label htmlFor="new-password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">New password</label>
        <input
          id="new-password"
          type="password"
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>
      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Confirm password</label>
        <input
          id="confirm-password"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
        {loading ? "Setting password…" : "Set password"}
      </button>
    </form>
  );
}

export default function SetPasswordPage() {
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
            Set your password
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Confirm the account below, then choose a password.
          </p>

          <div className="mt-6">
            <Suspense>
              <SetPasswordForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
