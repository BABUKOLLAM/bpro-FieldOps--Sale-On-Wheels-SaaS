import { apiGet } from "@/lib/api";
import { CARD_CLASS } from "@/components/ui/Card";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import ExportCsvButton from "@/components/ExportCsvButton";

type Paginated<T> = { count: number; results: T[] };

type CreditNoteLine = { id: string; qty: string; condition: "sellable" | "damaged" | "expired" };

type CreditNote = {
  id: string;
  credit_note_no: string;
  customer_name: string;
  agent_name: string;
  reason_code: string;
  note_date: string;
  grand_total: string;
  sync_status: "pending" | "synced" | "failed";
  lines: CreditNoteLine[];
};

const SYNC_TONE: Record<CreditNote["sync_status"], BadgeTone> = {
  synced: "success",
  pending: "neutral",
  failed: "danger",
};

const CONDITION_TONE: Record<CreditNoteLine["condition"], BadgeTone> = {
  sellable: "success",
  damaged: "warning",
  expired: "danger",
};

function conditionSummary(note: CreditNote) {
  const counts: Record<string, number> = {};
  for (const line of note.lines) {
    counts[line.condition] = (counts[line.condition] || 0) + 1;
  }
  return counts;
}

/** Back-office visibility for field-captured returns (BRD FR-04). Each
 * line's condition (sellable/damaged/expired) already drives a reverse-
 * logistics stock posting server-side (FM-11) — this surfaces that same
 * breakdown so the back office can see it without querying the ledger
 * directly. */
export default async function ReturnsPage() {
  const data = await apiGet<Paginated<CreditNote>>("/api/sales/credit-notes/");
  const totalValue = data.results.reduce((sum, n) => sum + Number(n.grand_total), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Returns
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Returns &amp; replacements against a prior sale (BRD FR-04).
            Condition per line drives the reverse-logistics stock posting
            (FM-11) — damaged/expired units still need a warehouse
            reconciliation pass; see the Fleet page&rsquo;s reverse-logistics
            section.
          </p>
        </div>
        <ExportCsvButton
          data={data.results.map((n) => ({
            credit_note_no: n.credit_note_no,
            customer: n.customer_name,
            agent: n.agent_name,
            reason: n.reason_code,
            note_date: n.note_date,
            value: n.grand_total,
            sync_status: n.sync_status,
          }))}
          filename="returns.csv"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className={`${CARD_CLASS} p-4`}>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Total value
          </p>
          <p className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
            ₹{totalValue.toLocaleString("en-IN")}
          </p>
        </div>
        <div className={`${CARD_CLASS} p-4`}>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Returns
          </p>
          <p className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
            {data.count}
          </p>
        </div>
      </div>

      <div className={`overflow-x-auto ${CARD_CLASS}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              <th className="px-4 py-2.5">Credit note</th>
              <th className="px-4 py-2.5">Customer</th>
              <th className="px-4 py-2.5">Agent</th>
              <th className="px-4 py-2.5">Reason</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Value</th>
              <th className="px-4 py-2.5">Condition</th>
              <th className="px-4 py-2.5">Sync</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {data.results.map((n) => {
              const counts = conditionSummary(n);
              return (
                <tr key={n.id}>
                  <td className="px-4 py-2.5 font-mono text-xs text-neutral-700 dark:text-neutral-300">
                    {n.credit_note_no || n.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                    {n.customer_name}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-500 dark:text-neutral-400">
                    {n.agent_name}
                  </td>
                  <td className="px-4 py-2.5 capitalize text-neutral-700 dark:text-neutral-300">
                    {n.reason_code.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-500 dark:text-neutral-400">
                    {n.note_date}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                    ₹{Number(n.grand_total).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(Object.keys(counts) as CreditNoteLine["condition"][]).map((c) => (
                        <Badge key={c} tone={CONDITION_TONE[c]}>
                          {counts[c]} {c}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={SYNC_TONE[n.sync_status]}>{n.sync_status}</Badge>
                  </td>
                </tr>
              );
            })}
            {data.results.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400"
                >
                  No returns recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
