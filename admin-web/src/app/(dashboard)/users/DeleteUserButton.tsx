"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteUserButton({ userId, deletable }: { userId: string; deletable: boolean }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("Permanently delete this user? This cannot be undone.")) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/proxy/users/${userId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Could not delete this user.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this user.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!deletable) {
    return (
      <span
        title="Has sales, trip, expense, or attendance history — deactivate instead of deleting."
        className="text-xs text-neutral-400 dark:text-neutral-600 cursor-not-allowed"
      >
        Delete
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        onClick={handleDelete}
        disabled={submitting}
        className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-500 disabled:opacity-60"
      >
        {submitting ? "…" : "Delete"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
