import { apiGet } from "@/lib/api";
import UserForm from "./UserForm";
import DeactivateUserButton from "./DeactivateUserButton";

type Paginated<T> = { count: number; results: T[] };

type UserRow = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  phone: string;
  employee_code: string | null;
  is_field_agent: boolean;
  roles: string[];
  is_active: boolean;
};

type Role = { id: string; name: string; is_active: boolean };

const ROLE_LABELS: Record<string, string> = {
  van_salesman: "Van Salesman",
  pre_sales_order_booker: "Pre-Sales / Order Booker",
  sales_supervisor: "Sales Supervisor",
  back_office_admin: "Back-Office Admin",
  finance_accounts: "Finance / Accounts",
  fleet_manager: "Fleet Manager",
  system_it_admin: "System / IT Admin",
};

export default async function UsersPage() {
  const [users, roles] = await Promise.all([
    apiGet<Paginated<UserRow>>("/api/users/"),
    apiGet<Paginated<Role>>("/api/roles/"),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Users</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Create field, supervisor, and back-office accounts and assign roles (AR-06).
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">All Users ({users.count})</h2>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Username</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">Roles</th>
                <th className="px-4 py-2 font-medium">Field Agent</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {users.results.map((u) => (
                <tr key={u.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                    {u.employee_code && <span className="ml-2 text-xs text-slate-400">#{u.employee_code}</span>}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">{u.username}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{u.phone || "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 && <span className="text-xs text-slate-400">No role</span>}
                      {u.roles.map((r) => (
                        <span
                          key={r}
                          className="rounded-full bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 text-xs text-indigo-700 dark:text-indigo-300"
                        >
                          {ROLE_LABELS[r] || r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{u.is_field_agent ? "Yes" : "—"}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.is_active
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {u.is_active ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td className="px-4 py-2">{u.is_active && <DeactivateUserButton userId={u.id} />}</td>
                </tr>
              ))}
              {users.results.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <UserForm roles={roles.results.filter((r) => r.is_active)} />
      </section>
    </div>
  );
}
