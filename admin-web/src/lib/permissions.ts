// Mirrors backend/apps/accounts/constants.py — there is no API that lists
// permission codes, so this is hand-kept in sync the same way lib/pricing.ts
// mirrors the rate card.

export type PermissionGroup = {
  domain: string;
  permissions: { code: string; label: string }[];
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    domain: "Catalog",
    permissions: [
      { code: "catalog.item.manage", label: "Manage items, categories & schemes" },
      { code: "catalog.item.view", label: "View catalog" },
    ],
  },
  {
    domain: "Customers",
    permissions: [
      { code: "customers.manage", label: "Manage customers" },
      { code: "customers.view", label: "View customers" },
      { code: "customers.credit_limit.override", label: "Override credit-limit blocks" },
    ],
  },
  {
    domain: "Sales",
    permissions: [
      { code: "sales.invoice.create", label: "Create invoices" },
      { code: "sales.order.create", label: "Create sales orders" },
      { code: "sales.receipt.create", label: "Record receipts" },
      { code: "sales.return.create", label: "Process returns" },
      { code: "sales.view_own", label: "View own sales" },
      { code: "sales.view_all", label: "View all sales" },
    ],
  },
  {
    domain: "Fleet",
    permissions: [
      { code: "fleet.trip.manage_own", label: "Manage own trips" },
      { code: "fleet.vehicle.manage", label: "Manage vehicles" },
      { code: "fleet.view_all", label: "View fleet-wide data" },
    ],
  },
  {
    domain: "Inventory",
    permissions: [
      { code: "inventory.stock_transfer.create_own", label: "Create own stock transfers" },
      { code: "inventory.manage", label: "Manage inventory" },
    ],
  },
  {
    domain: "Integrations",
    permissions: [
      { code: "integrations.sync.view", label: "View sync status" },
      { code: "integrations.sync.retry", label: "Retry failed syncs" },
    ],
  },
  {
    domain: "Reporting",
    permissions: [{ code: "reporting.dashboard.view", label: "View dashboards & reports" }],
  },
  {
    domain: "Users & Roles",
    permissions: [
      { code: "users.manage", label: "Manage users" },
      { code: "roles.manage", label: "Manage roles & permissions" },
    ],
  },
  {
    domain: "Expenses",
    permissions: [
      { code: "expenses.create_own", label: "Submit own expenses" },
      { code: "expenses.view_all", label: "View all expenses" },
      { code: "expenses.approve", label: "Approve/reject expenses" },
    ],
  },
  {
    domain: "Attendance",
    permissions: [
      { code: "attendance.create_own", label: "Check in / check out" },
      { code: "attendance.view_all", label: "View all attendance records" },
    ],
  },
  {
    domain: "Governance",
    permissions: [
      { code: "governance.master_settings.manage", label: "Propose Master Settings & role changes" },
      { code: "governance.change_request.approve", label: "Approve/reject pending changes" },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.permissions);

export const PERMISSION_LABELS: Record<string, string> = Object.fromEntries(
  ALL_PERMISSIONS.map((p) => [p.code, p.label])
);
