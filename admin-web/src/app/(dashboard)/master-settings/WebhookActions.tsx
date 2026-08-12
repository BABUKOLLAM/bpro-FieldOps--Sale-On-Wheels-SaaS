"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WebhookActions({ webhookId }: { webhookId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"rotate" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function rotateSecret() {
    setBusy("rotate");
    setError(null);
    try {
      const response = await fetch(`/api/proxy/integrations/webhooks/${webhookId}/rotate_secret`, { method: "POST" });
      if (!response.ok) throw new Error(JSON.stringify(await response.json().catch(() => ({}))));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rotate secret.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    setError(null);
    try {
      const response = await fetch(`/api/proxy/integrations/webhooks/${webhookId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(JSON.stringify(await response.json().catch(() => ({}))));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove webhook.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={rotateSecret}
        disabled={busy !== null}
        className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:text-orange-500 disabled:opacity-60"
      >
        {busy === "rotate" ? "Rotating…" : "Rotate secret"}
      </button>
      <button
        onClick={remove}
        disabled={busy !== null}
        className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-500 disabled:opacity-60"
      >
        {busy === "delete" ? "Removing…" : "Remove"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
