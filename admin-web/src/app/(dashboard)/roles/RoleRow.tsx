"use client";

import { useState } from "react";
import RoleForm from "./RoleForm";
import { PERMISSION_LABELS } from "@/lib/permissions";
import { CARD_CLASS } from "@/components/ui/Card";

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
    <div className={`${CARD_CLASS} p-4`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            {ROLE_LABELS[role.name] || role.name}
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {role.permissions.length} permission{role.permissions.length === 1 ? "" : "s"} ·{" "}
            {role.is_active ? "Active" : "Inactive"}
          </p>
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-500"
        >
          {editing ? "Close" : "Edit permissions"}
        </button>
      </div>

      {!editing && role.permissions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {role.permissions.map((code) => (
            <span
              key={code}
              className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs text-neutral-600 dark:text-neutral-300"
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
