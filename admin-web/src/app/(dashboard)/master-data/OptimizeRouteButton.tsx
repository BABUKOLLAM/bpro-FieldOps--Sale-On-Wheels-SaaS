"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OptimizeRouteButton({ beatId }: { beatId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleOptimize() {
    setSubmitting(true);
    try {
      await fetch(`/api/proxy/customers/beats/${beatId}/optimize-route`, { method: "POST" });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      onClick={handleOptimize}
      disabled={submitting}
      title="Nearest-neighbor re-order by straight-line distance between outlet addresses"
      className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-500 disabled:opacity-60"
    >
      {submitting ? "Optimizing…" : "Optimize Route"}
    </button>
  );
}
