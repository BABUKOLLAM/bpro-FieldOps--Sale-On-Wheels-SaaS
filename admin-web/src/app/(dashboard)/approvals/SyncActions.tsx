"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncActions({ entryId, status }: { entryId: string; status: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function call(action: "retry" | "resolve") {
    setSubmitting(true);
    try {
      await fetch(`/api/proxy/integrations/sync-log/${entryId}/${action}`, { method: "POST", body: JSON.stringify({}) });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "acknowledged" || status === "sent") return null;

  return (
    <div className="flex gap-2">
      <button
        onClick={() => call("retry")}
        disabled={submitting}
        className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-neutral-950 hover:bg-amber-500 disabled:opacity-60"
      >
        Retry
      </button>
      {status === "failed_permanent" && (
        <button
          onClick={() => call("resolve")}
          disabled={submitting}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          Mark resolved
        </button>
      )}
    </div>
  );
}
