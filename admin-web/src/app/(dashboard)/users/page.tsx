import { apiGet } from "@/lib/api";
import UserForm from "./UserForm";
import UserStatusButton from "./UserStatusButton";
import DeleteUserButton from "./DeleteUserButton";
import RoleAssignments from "./RoleAssignments";
import { CARD_CLASS } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

type Paginated<T> = { count: number; results: T[] };

type RoleAssignment = { id: string; role_id: string; role_name: string };

type UserRow = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  phone: string;
  employee_code: string | null;
  is_field_agent: boolean;
  roles: string[];
  role_assignments: RoleAssignment[];
  is_active: boolean;
  deletable: boolean;
};

type Role = { id: string; name: string; is_active: boolean };

export default async function UsersPage() {
  const [users, roles] = await Promise.all([
    apiGet<Paginated<UserRow>>("/api/users/"),
    apiGet<Paginated<Role>>("/api/roles/"),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Users</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Create field, supervisor, and back-office accounts and assign roles (AR-06).
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">All Users ({users.count})</h2>
        <div className={`${CARD_CLASS} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
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
                <tr key={u.id} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                    {u.employee_code && <span className="ml-2 text-xs text-neutral-400">#{u.employee_code}</span>}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-neutral-700 dark:text-neutral-300">{u.username}</td>
                  <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">{u.phone || "—"}</td>
                  <td className="px-4 py-2">
                    <RoleAssignments
                      userId={u.id}
                      assignments={u.role_assignments}
                      availableRoles={roles.results.filter((r) => r.is_active)}
                    />
                  </td>
                  <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">{u.is_field_agent ? "Yes" : "—"}</td>
                  <td className="px-4 py-2">
                    <Badge tone={u.is_active ? "success" : "neutral"}>
                      {u.is_active ? "Active" : "Deactivated"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col items-start gap-1">
                      <UserStatusButton userId={u.id} isActive={u.is_active} />
                      <DeleteUserButton userId={u.id} deletable={u.deletable} />
                    </div>
                  </td>
                </tr>
              ))}
              {users.results.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-neutral-400">
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
