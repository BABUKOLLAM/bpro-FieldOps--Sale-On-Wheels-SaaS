"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

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
    <Button
      onClick={handleReject}
      disabled={submitting} variant="danger" size="sm">
      {submitting ? "Rejecting…" : "Reject"}
    </Button>
  );
}
