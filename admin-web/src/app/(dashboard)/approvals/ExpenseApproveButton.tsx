"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

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
    <Button
      onClick={handleApprove}
      disabled={submitting} variant="success" size="sm">
      {submitting ? "Approving…" : "Approve"}
    </Button>
  );
}
