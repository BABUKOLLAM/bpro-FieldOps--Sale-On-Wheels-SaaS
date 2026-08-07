"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERMISSION_GROUPS } from "@/lib/permissions";

export default function RoleForm({
  roleId,
  initialPermissions,
  initialActive,
  onDone,
}: {
  roleId: string;
  initialPermissions: string[];
  initialActive: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(initialPermissions));
  const [isActive, setIsActive] = useState(initialActive);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/proxy/roles/${roleId}`, {
        method: "PATCH",
        body: JSON.stringify({ permissions: Array.from(selected), is_active: isActive }),
      });
      if (!response.ok) throw new Error(JSON.stringify(await response.json().catch(() => ({}))));
      router.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save role.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-4 space-y-4">
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Role active
      </label>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.domain}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {group.domain}
            </p>
            <ul className="mt-1.5 space-y-1">
              {group.permissions.map((p) => (
                <li key={p.code}>
                  <label className="flex items-start gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={selected.has(p.code)}
                      onChange={() => toggle(p.code)}
                    />
                    {p.label}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={submitting}
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save Role"}
        </button>
        <button onClick={onDone} className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
          Cancel
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
