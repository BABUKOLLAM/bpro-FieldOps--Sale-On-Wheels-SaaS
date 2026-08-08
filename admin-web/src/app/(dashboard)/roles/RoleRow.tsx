"use client";

import { useState } from "react";
import RoleForm from "./RoleForm";
import { PERMISSION_LABELS } from "@/lib/permissions";

type Role = { id: string; name: string; permissions: string[]; is_active: boolean };

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  van_salesman: "Van Salesman / Field Sales Executive",
  pre_sales_order_booker: "Pre-Sales / Order Booker",
  sales_supervisor: "Sales Supervisor / Area Sales Manager",
  back_office_admin: "Admin (Back-Office)",
  finance_accounts: "Finance / Accounts User",
  fleet_manager: "Fleet / Transport Manager",
  system_it_admin: "IT Head (System/IT Administrator)",
};

export default function RoleRow({ role }: { role: Role }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            {ROLE_LABELS[role.name] || role.name}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {role.permissions.length} permission{role.permissions.length === 1 ? "" : "s"} ·{" "}
            {role.is_active ? "Active" : "Inactive"}
          </p>
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
        >
          {editing ? "Close" : "Edit permissions"}
        </button>
      </div>

      {!editing && role.permissions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {role.permissions.map((code) => (
            <span
              key={code}
              className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300"
            >
              {PERMISSION_LABELS[code] || code}
            </span>
          ))}
        </div>
      )}

      {editing && (
        <RoleForm
          roleId={role.id}
          initialPermissions={role.permissions}
          initialActive={role.is_active}
          onDone={() => setEditing(false)}
        />
      )}
    </div>
  );
}
