import { apiGet } from "@/lib/api";
import { CARD_CLASS } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import SignupRequestActions from "./SignupRequestActions";

type Paginated<T> = { count: number; results: T[] };

type SignupRequestRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  requested_role_name: string;
  requested_role_display: string;
  department: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  decided_by_name: string | null;
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

const STATUS_TONE: Record<SignupRequestRow["status"], "warning" | "success" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

export default async function SignupRequestsPage() {
  const [requests, roles] = await Promise.all([
    apiGet<Paginated<SignupRequestRow>>("/api/signup-requests/"),
    apiGet<Paginated<Role>>("/api/roles/"),
  ]);

  const pending = requests.results.filter((r) => r.status === "pending");
  const decided = requests.results.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Signup Requests</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Self-service access requests from the public sign-up page. Approving one creates a real
          account and emails the person a one-time link to set their own password — nothing is
          granted automatically.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className={`${CARD_CLASS} px-4 py-6 text-center text-sm text-neutral-400`}>
            No requests waiting on a decision.
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <div key={r.id} className={`${CARD_CLASS} p-4`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                      {r.name} <span className="font-normal text-neutral-400">— {r.email}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      {r.phone && <>{r.phone} · </>}
                      Requested: {ROLE_LABELS[r.requested_role_name] || r.requested_role_display || "—"}
                      {r.department && <> · {r.department}</>}
                    </p>
                    {r.message && (
                      <p className="mt-2 rounded-md bg-neutral-50 dark:bg-neutral-800/50 px-3 py-2 text-xs text-neutral-600 dark:text-neutral-300">
                        &ldquo;{r.message}&rdquo;
                      </p>
                    )}
                  </div>
                  <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                </div>
                <SignupRequestActions requestId={r.id} roles={roles.results.filter((role) => role.is_active)} />
              </div>
            ))}
          </div>
        )}
      </section>

      {decided.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Decided</h2>
          <div className={`${CARD_CLASS} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Requested</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Decided by</th>
                </tr>
              </thead>
              <tbody>
                {decided.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">{r.name}</td>
                    <td className="px-4 py-2 font-mono text-xs text-neutral-700 dark:text-neutral-300">{r.email}</td>
                    <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">
                      {ROLE_LABELS[r.requested_role_name] || r.requested_role_display || "—"}
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                    </td>
                    <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">{r.decided_by_name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
