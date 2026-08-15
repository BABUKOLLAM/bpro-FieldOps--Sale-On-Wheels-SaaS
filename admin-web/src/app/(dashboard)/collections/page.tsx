import { apiGet } from "@/lib/api";
import { CARD_CLASS } from "@/components/ui/Card";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import ExportCsvButton from "@/components/ExportCsvButton";

type Paginated<T> = { count: number; results: T[] };

type Receipt = {
  id: string;
  receipt_no: string;
  customer_name: string;
  agent_name: string;
  mode: "cash" | "cheque" | "upi" | "card";
  amount: string;
  reference_no: string;
  received_at: string;
  sync_status: "pending" | "synced" | "failed";
};

const SYNC_TONE: Record<Receipt["sync_status"], BadgeTone> = {
  synced: "success",
  pending: "neutral",
  failed: "danger",
};

/** Back-office visibility for field-captured collections (BRD FR-03) —
 * the mobile Collections screen and this app's push protocol have
 * existed since the same slice; this is the other half, so a
 * ₹50,000 cash collection isn't only visible by querying the database
 * directly. */
export default async function CollectionsPage() {
  const data = await apiGet<Paginated<Receipt>>("/api/sales/receipts/");
  const totalAmount = data.results.reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Collections
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Payments field agents recorded against a customer&rsquo;s account
            (BRD FR-03). Unallocated for now — see the mobile Collections
            screen&rsquo;s notes on per-invoice allocation.
          </p>
        </div>
        <ExportCsvButton
          data={data.results.map((r) => ({
            receipt_no: r.receipt_no,
            customer: r.customer_name,
            agent: r.agent_name,
            mode: r.mode,
            amount: r.amount,
            reference_no: r.reference_no,
            received_at: r.received_at,
            sync_status: r.sync_status,
          }))}
          filename="collections.csv"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className={`${CARD_CLASS} p-4`}>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Total collected
          </p>
          <p className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
            ₹{totalAmount.toLocaleString("en-IN")}
          </p>
        </div>
        <div className={`${CARD_CLASS} p-4`}>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Collections
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
              <th className="px-4 py-2.5">Receipt</th>
              <th className="px-4 py-2.5">Customer</th>
              <th className="px-4 py-2.5">Agent</th>
              <th className="px-4 py-2.5">Mode</th>
              <th className="px-4 py-2.5">Amount</th>
              <th className="px-4 py-2.5">Reference</th>
              <th className="px-4 py-2.5">Received</th>
              <th className="px-4 py-2.5">Sync</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {data.results.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 font-mono text-xs text-neutral-700 dark:text-neutral-300">
                  {r.receipt_no || r.id.slice(0, 8)}
                </td>
                <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                  {r.customer_name}
                </td>
                <td className="px-4 py-2.5 text-neutral-500 dark:text-neutral-400">
                  {r.agent_name}
                </td>
                <td className="px-4 py-2.5 capitalize text-neutral-700 dark:text-neutral-300">
                  {r.mode}
                </td>
                <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                  ₹{Number(r.amount).toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-neutral-500 dark:text-neutral-400">
                  {r.reference_no || "—"}
                </td>
                <td className="px-4 py-2.5 text-neutral-500 dark:text-neutral-400">
                  {new Date(r.received_at).toLocaleString()}
                </td>
                <td className="px-4 py-2.5">
                  <Badge tone={SYNC_TONE[r.sync_status]}>{r.sync_status}</Badge>
                </td>
              </tr>
            ))}
            {data.results.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400"
                >
                  No collections recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
