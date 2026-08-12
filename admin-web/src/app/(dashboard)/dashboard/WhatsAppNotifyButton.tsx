"use client";

import { useState } from "react";

export default function WhatsAppNotifyButton({ invoiceId }: { invoiceId: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleClick() {
    setState("sending");
    try {
      const response = await fetch(`/api/proxy/sales/invoices/${invoiceId}/notify-whatsapp`, { method: "POST" });
      if (!response.ok) throw new Error();
      setState("sent");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return <span className="text-xs text-emerald-600 dark:text-emerald-400">Sent</span>;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === "sending"}
      className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-500 disabled:opacity-60"
    >
      {state === "sending" ? "Sending…" : state === "error" ? "Retry WhatsApp" : "Notify WhatsApp"}
    </button>
  );
}
