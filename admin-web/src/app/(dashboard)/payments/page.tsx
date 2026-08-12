import { apiGet } from "@/lib/api";

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

type PaginatedResponse = { count: number; results: PaymentOrder[] };

export default async function PaymentsPage() {
  const data = await apiGet<PaginatedResponse>("/api/payments/orders/");

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

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
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
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      o.gateway_type === "mock"
                        ? "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                    }`}
                  >
                    {o.gateway_type}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                  ₹{o.amount} {o.currency}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      o.status === "paid"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : o.status === "failed"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                          : "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
                    }`}
                  >
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-neutral-500 dark:text-neutral-400">
                  {new Date(o.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {data.results.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400">
                  No payment orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
