"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ExpenseApproveButton({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleApprove() {
    setSubmitting(true);
    try {
      await fetch(`/api/proxy/expenses/${expenseId}/approve`, { method: "POST" });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      onClick={handleApprove}
      disabled={submitting}
      className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
    >
      {submitting ? "Approving…" : "Approve"}
    </button>
  );
}
