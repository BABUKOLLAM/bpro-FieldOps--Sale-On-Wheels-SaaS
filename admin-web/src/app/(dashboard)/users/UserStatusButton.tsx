"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UserStatusButton({ userId, isActive }: { userId: string; isActive: boolean }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleToggle() {
    const action = isActive ? "deactivate" : "activate";
    if (isActive && !confirm("Deactivate this user? They'll lose access immediately.")) return;
    setSubmitting(true);
    try {
      await fetch(`/api/proxy/users/${userId}/${action}`, { method: "POST" });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={submitting}
      className={
        isActive
          ? "text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-500 disabled:opacity-60"
          : "text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 disabled:opacity-60"
      }
    >
      {submitting ? "…" : isActive ? "Deactivate" : "Reactivate"}
    </button>
  );
}
