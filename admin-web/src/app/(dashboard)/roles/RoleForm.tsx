"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import Button from "@/components/ui/Button";

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
  const [reason, setReason] = useState("");
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
      const nextPermissions = Array.from(selected).sort();
      const proposedChanges: Record<string, unknown> = {};
      if (JSON.stringify(nextPermissions) !== JSON.stringify([...initialPermissions].sort())) {
        proposedChanges.permissions = Array.from(selected);
      }
      if (isActive !== initialActive) {
        proposedChanges.is_active = isActive;
      }
      if (Object.keys(proposedChanges).length === 0) {
        setError("No changes to propose.");
        return;
      }

      const response = await fetch("/api/proxy/governance/change-requests", {
        method: "POST",
        body: JSON.stringify({
          target_type: "role",
          target_id: roleId,
          proposed_changes: proposedChanges,
          reason,
        }),
      });
      if (!response.ok) throw new Error(JSON.stringify(await response.json().catch(() => ({}))));
      router.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to propose change.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-4 space-y-4">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        This proposes a change — it only takes effect once a Super Admin or Admin approves it (AR-06 role-based
        approval).
      </p>

      <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Role active
      </label>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.domain}>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              {group.domain}
            </p>
            <ul className="mt-1.5 space-y-1">
              {group.permissions.map((p) => (
                <li key={p.code}>
                  <label className="flex items-start gap-1.5 text-sm text-neutral-700 dark:text-neutral-300">
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

      <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
        Reason for this change (optional)
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. restrict credit-override to Finance only"
          className="mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-50"
        />
      </label>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={submitting}>
          {submitting ? "Submitting…" : "Propose Change"}
        </Button>
        <button onClick={onDone} className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
          Cancel
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
