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
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">UPI/Card Payments</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Gateway-ready scaffolding (BRD §18). With no real gateway configured, every order below is tagged{" "}
          <span className="font-mono">mock</span> and can never be marked paid except by an explicit,
          signature-verified confirmation — nothing here moves money on its own.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th className="px-4 py-2.5">Order</th>
              <th className="px-4 py-2.5">Gateway</th>
              <th className="px-4 py-2.5">Amount</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.results.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-700 dark:text-slate-300">
                  {o.gateway_order_id || o.id}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      o.gateway_type === "mock"
                        ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                    }`}
                  >
                    {o.gateway_type}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                  ₹{o.amount} {o.currency}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      o.status === "paid"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : o.status === "failed"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}
                  >
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                  {new Date(o.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {data.results.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
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
