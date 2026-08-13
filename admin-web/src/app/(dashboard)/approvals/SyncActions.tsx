"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

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
      <Button onClick={() => call("retry")} disabled={submitting} size="sm">
        Retry
      </Button>
      {status === "failed_permanent" && (
        <Button
          onClick={() => call("resolve")}
          disabled={submitting}
          variant="secondary"
          size="sm"
        >
          Mark resolved
        </Button>
      )}
    </div>
  );
}
