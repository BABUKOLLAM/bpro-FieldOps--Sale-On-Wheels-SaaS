"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ExpenseRejectButton({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleReject() {
    const reason = window.prompt("Reason for rejecting this expense?") || "";
    setSubmitting(true);
    try {
      await fetch(`/api/proxy/expenses/${expenseId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      onClick={handleReject}
      disabled={submitting}
      className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-60"
    >
      {submitting ? "Rejecting…" : "Reject"}
    </button>
  );
}
