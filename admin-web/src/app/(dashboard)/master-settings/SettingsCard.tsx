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
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
          {badges && badges.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300"
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
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
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
