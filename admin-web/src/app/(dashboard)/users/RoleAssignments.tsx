"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS } from "@/lib/roleLabels";

type Assignment = { id: string; role_id: string; role_name: string };
type Role = { id: string; name: string };

export default function RoleAssignments({
  userId,
  assignments,
  availableRoles,
}: {
  userId: string;
  assignments: Assignment[];
  availableRoles: Role[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignedRoleIds = new Set(assignments.map((a) => a.role_id));
  const rolesLeftToAssign = availableRoles.filter((r) => !assignedRoleIds.has(r.id));

  async function handleRemove(assignmentId: string) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/proxy/user-roles/${assignmentId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not remove this role.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove this role.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedRoleId) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/proxy/user-roles", {
        method: "POST",
        body: JSON.stringify({ user: userId, role: selectedRoleId }),
      });
      if (!response.ok) throw new Error("Could not add this role.");
      setSelectedRoleId("");
      setAdding(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this role.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1">
        {assignments.length === 0 && <span className="text-xs text-neutral-400">No role</span>}
        {assignments.map((a) => (
          <span
            key={a.id}
            className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300"
          >
            {ROLE_LABELS[a.role_name] || a.role_name}
            <button
              type="button"
              onClick={() => handleRemove(a.id)}
              disabled={submitting}
              title="Remove this role"
              className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-100 disabled:opacity-60"
            >
              ×
            </button>
          </span>
        ))}

        {!adding && rolesLeftToAssign.length > 0 && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400"
          >
            + Add role
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="flex items-center gap-1">
          <select
            autoFocus
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-1.5 py-1 text-xs text-neutral-900 dark:text-neutral-100"
          >
            <option value="">Select a role…</option>
            {rolesLeftToAssign.map((r) => (
              <option key={r.id} value={r.id}>
                {ROLE_LABELS[r.name] || r.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={submitting || !selectedRoleId}
            className="text-xs font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 disabled:opacity-60"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setSelectedRoleId("");
            }}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
          >
            Cancel
          </button>
        </form>
      )}

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
