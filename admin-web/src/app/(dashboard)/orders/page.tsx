import { apiGet } from "@/lib/api";
import { CARD_CLASS } from "@/components/ui/Card";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import ExportCsvButton from "@/components/ExportCsvButton";

type Paginated<T> = { count: number; results: T[] };

type OrderLine = { id: string; qty: string; rate: string };

type SalesOrder = {
  id: string;
  order_no: string;
  customer_name: string;
  agent_name: string;
  order_date: string;
  status: "open" | "fulfilled" | "cancelled";
  notes: string;
  lines: OrderLine[];
};

const STATUS_TONE: Record<SalesOrder["status"], BadgeTone> = {
  open: "warning",
  fulfilled: "success",
  cancelled: "danger",
};

function orderTotal(order: SalesOrder) {
  return order.lines.reduce((sum, l) => sum + Number(l.qty) * Number(l.rate), 0);
}

/** Back-office visibility for field-captured pre-orders (order today,
 * deliver later — the Pre-Sales / Order Booker flow). The mobile Order
 * screen and this app's push protocol already exist; this closes the
 * loop so the back office can see and fulfil what's been booked. */
export default async function OrdersPage() {
  const data = await apiGet<Paginated<SalesOrder>>("/api/sales/orders/");
  const openCount = data.results.filter((o) => o.status === "open").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Orders
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Pre-orders captured in the field, deliver-later — no stock or GST
            posted until fulfilled by the back office.
          </p>
        </div>
        <ExportCsvButton
          data={data.results.map((o) => ({
            order_no: o.order_no,
            customer: o.customer_name,
            agent: o.agent_name,
            order_date: o.order_date,
            status: o.status,
            items: o.lines.length,
            estimated_total: orderTotal(o).toFixed(2),
            notes: o.notes,
          }))}
          filename="orders.csv"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className={`${CARD_CLASS} p-4`}>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Open orders
          </p>
          <p className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
            {openCount}
          </p>
        </div>
        <div className={`${CARD_CLASS} p-4`}>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Total orders
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
              <th className="px-4 py-2.5">Order</th>
              <th className="px-4 py-2.5">Customer</th>
              <th className="px-4 py-2.5">Agent</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Items</th>
              <th className="px-4 py-2.5">Est. total</th>
              <th className="px-4 py-2.5">Notes</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {data.results.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-2.5 font-mono text-xs text-neutral-700 dark:text-neutral-300">
                  {o.order_no || o.id.slice(0, 8)}
                </td>
                <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                  {o.customer_name}
                </td>
                <td className="px-4 py-2.5 text-neutral-500 dark:text-neutral-400">
                  {o.agent_name}
                </td>
                <td className="px-4 py-2.5 text-neutral-500 dark:text-neutral-400">
                  {o.order_date}
                </td>
                <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                  {o.lines.length}
                </td>
                <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                  ₹{orderTotal(o).toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-2.5 max-w-xs truncate text-neutral-500 dark:text-neutral-400">
                  {o.notes || "—"}
                </td>
                <td className="px-4 py-2.5">
                  <Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge>
                </td>
              </tr>
            ))}
            {data.results.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400"
                >
                  No orders recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
