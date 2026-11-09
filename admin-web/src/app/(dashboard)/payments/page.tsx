import DateRangeFilter from "@/components/DateRangeFilter";
import Pager from "@/components/Pager";
import { fetchDatedList, readListParams } from "@/lib/listPage";
import { CARD_CLASS } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

type PaymentOrder = {
  id: string;
  invoice: string;
  gateway_type: "mock" | "razorpay";
  gateway_order_id: string;
  amount: string;
  currency: string;
  status: "created" | "paid" | "failed";
  receipt: string | null;
  created_at: string;
};

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { range, error, page: requestedPage, context, query } = await readListParams(searchParams);
  const { data, page } = await fetchDatedList<PaymentOrder>("/api/payments/orders/", range, requestedPage);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">UPI/Card Payments</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Gateway-ready scaffolding (BRD §18). With no real gateway configured, every order below is tagged{" "}
          <span className="font-mono">mock</span> and can never be marked paid except by an explicit,
          signature-verified confirmation — nothing here moves money on its own.
        </p>
      </div>

      <DateRangeFilter value={range} context={context} query={query} error={error} label="Created date" />

      <div className={`overflow-x-auto ${CARD_CLASS}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              <th className="px-4 py-2.5">Order</th>
              <th className="px-4 py-2.5">Gateway</th>
              <th className="px-4 py-2.5">Amount</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {data.results.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-2.5 font-mono text-xs text-neutral-700 dark:text-neutral-300">
                  {o.gateway_order_id || o.id}
                </td>
                <td className="px-4 py-2.5">
                  <Badge tone={o.gateway_type === "mock" ? "neutral" : "success"}>
                    {o.gateway_type}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                  ₹{o.amount} {o.currency}
                </td>
                <td className="px-4 py-2.5">
                  <Badge
                    tone={
                      o.status === "paid"
                        ? "success"
                        : o.status === "failed"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {o.status}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-neutral-500 dark:text-neutral-400">
                  {new Date(o.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {data.results.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400">
                  {range.from || range.to ? "No payment orders in this date range." : "No payment orders yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager pathname="/payments" query={query} page={page} count={data.count} />
    </div>
  );
}
