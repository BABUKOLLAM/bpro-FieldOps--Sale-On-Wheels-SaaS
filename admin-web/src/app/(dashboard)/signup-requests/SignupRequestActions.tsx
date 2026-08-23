"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

type Role = { id: string; name: string; is_active: boolean };

const ROLE_LABELS: Record<string, string> = {
  van_salesman: "Van Salesman",
  pre_sales_order_booker: "Pre-Sales / Order Booker",
  sales_supervisor: "Sales Supervisor",
  back_office_admin: "Back-Office Admin",
  finance_accounts: "Finance / Accounts",
  fleet_manager: "Fleet Manager",
  system_it_admin: "System / IT Admin",
};

export default function SignupRequestActions({ requestId, roles }: { requestId: string; roles: Role[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [roleId, setRoleId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setPasswordUrl, setSetPasswordUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleApprove(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/proxy/signup-requests/${requestId}/approve`, {
        method: "POST",
        body: JSON.stringify({ role: roleId || undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(JSON.stringify(data));
      // Account now exists but has no password — this one-time link is
      // the only way to set one. Show it instead of refreshing right
      // away, or it's gone for good (the API never returns it again).
      setSetPasswordUrl(data.set_password_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve this request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyLink() {
    if (!setPasswordUrl) return;
    await navigator.clipboard.writeText(setPasswordUrl);
    setCopied(true);
  }

  async function handleReject() {
    const reason = prompt("Reason for rejecting (optional, sent to the applicant):") || "";
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/proxy/signup-requests/${requestId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error(JSON.stringify(await response.json().catch(() => ({}))));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject this request.");
    } finally {
      setSubmitting(false);
    }
  }

  if (setPasswordUrl) {
    return (
      <div className="mt-3 space-y-2 rounded-md border border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 p-3">
        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
          Account created. Share this one-time link with them so they can set their own password — it
          won&apos;t be shown again. It was also emailed to them automatically.
        </p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={setPasswordUrl}
            onFocus={(e) => e.target.select()}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-xs text-neutral-900 dark:text-neutral-100"
          />
          <Button type="button" onClick={handleCopyLink}>
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
        <Button type="button" variant="success" onClick={() => router.refresh()}>
          Done
        </Button>
      </div>
    );
  }

  if (!expanded) {
    return (
      <div className="mt-3 flex gap-2">
        <Button type="button" onClick={() => setExpanded(true)}>
          Approve…
        </Button>
        <button
          type="button"
          onClick={handleReject}
          disabled={submitting}
          className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-500 disabled:opacity-60"
        >
          Reject
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleApprove} className="mt-3 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 p-3">
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Assign role</label>
        <select
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className="mt-1 w-56 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
        >
          <option value="">No role yet</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {ROLE_LABELS[r.name] || r.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="success" disabled={submitting}>
        {submitting ? "Creating account…" : "Confirm & Create Account"}
      </Button>
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
      >
        Cancel
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
