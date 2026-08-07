"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeactivateUserButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleDeactivate() {
    if (!confirm("Deactivate this user? They'll lose access immediately.")) return;
    setSubmitting(true);
    try {
      await fetch(`/api/proxy/users/${userId}/deactivate`, { method: "POST" });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      onClick={handleDeactivate}
      disabled={submitting}
      className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-500 disabled:opacity-60"
    >
      {submitting ? "…" : "Deactivate"}
    </button>
  );
}
