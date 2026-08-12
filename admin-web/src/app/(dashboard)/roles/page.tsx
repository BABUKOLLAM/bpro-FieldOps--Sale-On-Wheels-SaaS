import { apiGet } from "@/lib/api";
import RoleRow from "./RoleRow";
import ChangeRequestRow, { type ChangeRequest } from "./ChangeRequestRow";

type Paginated<T> = { count: number; results: T[] };
type Role = { id: string; name: string; permissions: string[]; is_active: boolean };

export default async function RolesPage() {
  const roles = await apiGet<Paginated<Role>>("/api/roles/");

  // Only Super Admin/Admin/IT Head can see this — apiGet throws on the
  // backend's 403 for anyone without governance.master_settings.manage,
  // which just means "no pending-changes panel for this viewer."
  let pendingChanges: ChangeRequest[] = [];
  try {
    const pending = await apiGet<Paginated<ChangeRequest>>("/api/governance/change-requests/?status=pending");
    pendingChanges = pending.results;
  } catch {
    pendingChanges = [];
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Roles</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Roles are seeded per deployment. Permission changes go through Master Settings approval — Super Admin,
          Admin, and IT Head may propose; only Super Admin and Admin may approve (AR-06).
        </p>
      </div>

      {pendingChanges.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            Pending changes ({pendingChanges.length})
          </h2>
          <div className="space-y-2">
            {pendingChanges.map((changeRequest) => (
              <ChangeRequestRow key={changeRequest.id} changeRequest={changeRequest} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {roles.results.map((role) => (
          <RoleRow key={role.id} role={role} />
        ))}
      </div>
    </div>
  );
}
