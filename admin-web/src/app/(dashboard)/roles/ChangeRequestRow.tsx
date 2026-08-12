"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ChangeRequest = {
  id: string;
  target_label: string;
  proposed_changes: Record<string, unknown>;
  previous_snapshot: Record<string, unknown>;
  reason: string;
  requested_by_username: string;
  requested_at: string;
};

export default function ChangeRequestRow({ changeRequest }: { changeRequest: ChangeRequest }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function review(decision: "approve" | "reject") {
    setSubmitting(decision);
    setError(null);
    try {
      const response = await fetch(`/api/proxy/governance/change-requests/${changeRequest.id}/${decision}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error(JSON.stringify(await response.json().catch(() => ({}))));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${decision}.`);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="rounded-lg border border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{changeRequest.target_label}</p>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Proposed by {changeRequest.requested_by_username} ·{" "}
            {new Date(changeRequest.requested_at).toLocaleString()}
          </p>
          {changeRequest.reason && (
            <p className="mt-1 text-xs italic text-neutral-600 dark:text-neutral-300">&ldquo;{changeRequest.reason}&rdquo;</p>
          )}
          <dl className="mt-2 space-y-0.5 text-xs">
            {Object.entries(changeRequest.proposed_changes).map(([field, value]) => (
              <div key={field} className="flex flex-wrap gap-1">
                <dt className="font-medium text-neutral-600 dark:text-neutral-300">{field}:</dt>
                <dd className="text-neutral-500 dark:text-neutral-400">
                  {JSON.stringify(changeRequest.previous_snapshot[field])} →{" "}
                  <span className="font-medium text-neutral-900 dark:text-neutral-50">{JSON.stringify(value)}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => review("approve")}
            disabled={submitting !== null}
            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {submitting === "approve" ? "Approving…" : "Approve"}
          </button>
          <button
            onClick={() => review("reject")}
            disabled={submitting !== null}
            className="rounded-md bg-neutral-200 dark:bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-700 disabled:opacity-60"
          >
            {submitting === "reject" ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
