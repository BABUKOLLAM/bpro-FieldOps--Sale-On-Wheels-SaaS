"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type FieldSpec = {
  name: string;
  label: string;
  type: "text" | "number" | "boolean" | "url" | "list";
  value: string | number | boolean | string[];
};

function toEditableValue(field: FieldSpec): string | number | boolean {
  if (field.type === "list") return (field.value as string[]).join(", ");
  return field.value as string | number | boolean;
}

function toProposedValue(field: FieldSpec, editable: string | number | boolean): unknown {
  if (field.type === "list") {
    return String(editable)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (field.type === "number") return Number(editable);
  return editable;
}

function hasChanged(field: FieldSpec, editable: string | number | boolean): boolean {
  if (field.type === "list") {
    return JSON.stringify(toProposedValue(field, editable)) !== JSON.stringify(field.value);
  }
  return editable !== field.value;
}

export default function ProposeEditForm({
  targetType,
  targetId,
  fields,
  onDone,
}: {
  targetType: string;
  targetId: string;
  fields: FieldSpec[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string | number | boolean>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, toEditableValue(f)]))
  );
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(name: string, value: string | number | boolean) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    try {
      const proposedChanges: Record<string, unknown> = {};
      for (const field of fields) {
        const editable = values[field.name];
        if (hasChanged(field, editable)) {
          proposedChanges[field.name] = toProposedValue(field, editable);
        }
      }
      if (Object.keys(proposedChanges).length === 0) {
        setError("No changes to propose.");
        return;
      }

      const response = await fetch("/api/proxy/governance/change-requests", {
        method: "POST",
        body: JSON.stringify({ target_type: targetType, target_id: targetId, proposed_changes: proposedChanges, reason }),
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
    <div className="mt-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-4 space-y-3">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        This proposes a change — it only takes effect once a Super Admin or Admin approves it.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.name} className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            {field.label}
            {field.type === "boolean" ? (
              <input
                type="checkbox"
                className="ml-2 align-middle"
                checked={Boolean(values[field.name])}
                onChange={(e) => update(field.name, e.target.checked)}
              />
            ) : (
              <input
                type={field.type === "number" ? "number" : field.type === "url" ? "url" : "text"}
                value={String(values[field.name] ?? "")}
                onChange={(e) => update(field.name, e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-50"
              />
            )}
          </label>
        ))}
      </div>

      <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
        Reason for this change (optional)
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-50"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={submitting}
          className="rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-amber-500 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Propose Change"}
        </button>
        <button onClick={onDone} className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
          Cancel
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
