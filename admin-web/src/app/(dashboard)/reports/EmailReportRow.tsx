"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

export default function EmailReportRow({ reportKey }: { reportKey: string }) {
  const [to, setTo] = useState("");
  const [format, setFormat] = useState<"xlsx" | "pdf">("xlsx");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/proxy/reporting/export/${reportKey}/email`, {
        method: "POST",
        body: JSON.stringify({ to, filetype: format }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Failed to send.");
      setMessage({ kind: "ok", text: `Sent to ${to}.` });
      setTo("");
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Failed to send." });
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSend} className="flex flex-wrap items-center gap-2">
      <input
        required
        type="email"
        placeholder="email@company.com"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="w-44 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1 text-xs text-neutral-900 dark:text-neutral-100"
      />
      <select
        value={format}
        onChange={(e) => setFormat(e.target.value as "xlsx" | "pdf")}
        className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1 text-xs text-neutral-900 dark:text-neutral-100"
      >
        <option value="xlsx">Excel</option>
        <option value="pdf">PDF</option>
      </select>
      <Button
        type="submit"
        disabled={sending} size="sm">
        {sending ? "Sending…" : "Email"}
      </Button>
      {message && (
        <span className={`text-xs ${message.kind === "ok" ? "text-emerald-600" : "text-red-600"}`}>
          {message.text}
        </span>
      )}
    </form>
  );
}
