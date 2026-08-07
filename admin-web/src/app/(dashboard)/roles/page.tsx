import { apiGet } from "@/lib/api";
import RoleRow from "./RoleRow";

type Paginated<T> = { count: number; results: T[] };
type Role = { id: string; name: string; permissions: string[]; is_active: boolean };

export default async function RolesPage() {
  const roles = await apiGet<Paginated<Role>>("/api/roles/");

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Roles</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Roles are seeded per deployment — edit which permissions each one grants (AR-06).
        </p>
      </div>

      <div className="space-y-4">
        {roles.results.map((role) => (
          <RoleRow key={role.id} role={role} />
        ))}
      </div>
    </div>
  );
}
