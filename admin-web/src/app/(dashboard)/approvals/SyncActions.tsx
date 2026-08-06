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
        className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
      >
        Retry
      </button>
      {status === "failed_permanent" && (
        <button
          onClick={() => call("resolve")}
          disabled={submitting}
          className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Mark resolved
        </button>
      )}
    </div>
  );
}
