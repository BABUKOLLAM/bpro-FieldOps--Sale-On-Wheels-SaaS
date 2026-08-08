"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RemoveTemplateStopButton({ stopId }: { stopId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleRemove() {
    setSubmitting(true);
    try {
      await fetch(`/api/proxy/customers/beat-template-stops/${stopId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      onClick={handleRemove}
      disabled={submitting}
      className="text-xs text-red-600 hover:text-red-500 disabled:opacity-60"
    >
      {submitting ? "…" : "Remove"}
    </button>
  );
}
