"use client";

import { useState, type ReactNode } from "react";
import ProposeEditForm, { type FieldSpec } from "./ProposeEditForm";

export default function SettingsCard({
  title,
  subtitle,
  badges,
  targetType,
  targetId,
  fields,
  extraActions,
}: {
  title: string;
  subtitle?: string;
  badges?: string[];
  targetType: string;
  targetId: string;
  fields: FieldSpec[];
  extraActions?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{subtitle}</p>}
          {badges && badges.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs text-neutral-600 dark:text-neutral-300"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {extraActions}
          <button
            onClick={() => setEditing((v) => !v)}
            className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-500"
          >
            {editing ? "Close" : "Edit"}
          </button>
        </div>
      </div>

      {editing && (
        <ProposeEditForm targetType={targetType} targetId={targetId} fields={fields} onDone={() => setEditing(false)} />
      )}
    </div>
  );
}
