"use client";

import { useState } from "react";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";

// Mirrors UserForm.tsx's ROLE_LABELS — deliberately excludes super_admin
// from the public form. This is purely what the applicant *requests*;
// the approving admin assigns the real role independently and isn't
// bound by it (see SignupRequestApproveSerializer on the backend), so
// omitting it here is a UX nicety, not an access-control decision.
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "van_salesman", label: "Van Salesman / Field Sales Executive" },
  { value: "pre_sales_order_booker", label: "Pre-Sales / Order Booker" },
  { value: "sales_supervisor", label: "Sales Supervisor / Area Sales Manager" },
  { value: "back_office_admin", label: "Back-Office / Admin User" },
  { value: "finance_accounts", label: "Finance / Accounts User" },
  { value: "fleet_manager", label: "Fleet / Transport Manager" },
  { value: "system_it_admin", label: "System / IT Administrator" },
];

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [requestedRole, setRequestedRole] = useState("");
  const [department, setDepartment] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/session/signup-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          requested_role_name: requestedRole,
          department,
          message,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data === "object" ? Object.values(data).flat().join(" ") || "Could not submit your request." : "Could not submit your request."
        );
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your request.");
    } finally {
      setSubmitting(false);
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
          <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">← Back to bpro FieldOps home</span>
        </Link>

        <div className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 shadow-lg shadow-neutral-900/5">
          {submitted ? (
            <div className="space-y-3 text-center">
              <h1 className="font-[family-name:var(--font-archivo)] text-xl font-bold text-neutral-900 dark:text-neutral-50">
                Request received
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                An administrator has been notified and will review your request. You&rsquo;ll be
                contacted with your login details once it&rsquo;s approved.
              </p>
              <Link
                href="/login"
                className="inline-block pt-2 text-sm font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-[family-name:var(--font-archivo)] text-xl font-bold text-neutral-900 dark:text-neutral-50">
                Request access
              </h1>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Ask for a bpro FieldOps account. An administrator reviews every request before
                access is granted.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Full name</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Phone</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Requesting role</label>
                    <select
                      required
                      value={requestedRole}
                      onChange={(e) => setRequestedRole(e.target.value)}
                      className="mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">Select a role…</option>
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Department</label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Message to the approver <span className="text-neutral-400">(optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
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
                  disabled={submitting}
                  className="w-full rounded-md bg-amber-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-amber-400 disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : "Request Access"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400">
                  Sign in
                </Link>
              </p>
            </>
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
