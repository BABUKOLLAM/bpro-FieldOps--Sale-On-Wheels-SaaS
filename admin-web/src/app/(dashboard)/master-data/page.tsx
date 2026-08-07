import { apiGet } from "@/lib/api";
import CustomerForm from "./CustomerForm";
import ItemForm from "./ItemForm";
import BeatForm from "./BeatForm";
import BeatStopForm from "./BeatStopForm";
import RemoveStopButton from "./RemoveStopButton";

type Paginated<T> = { count: number; results: T[] };

type Customer = {
  id: string;
  code: string;
  name: string;
  credit_limit: string;
  outstanding_balance: string;
  credit_status: string;
  is_blocked: boolean;
};

type Item = {
  id: string;
  sku: string;
  name: string;
  gst_rate: string;
  is_active: boolean;
  category: string | null;
  base_uom: string;
};

type Category = { id: string; name: string };
type UOM = { id: string; code: string; name: string };

type User = { id: string; username: string; first_name: string; is_field_agent: boolean };

type BeatStop = {
  id: string;
  customer: string;
  customer_detail: Customer;
  visit_sequence: number;
};

type Beat = {
  id: string;
  name: string;
  assigned_agent: string | null;
  is_active: boolean;
  stops: BeatStop[];
};

export default async function MasterDataPage() {
  const [customers, items, categories, uoms, beats, users] = await Promise.all([
    apiGet<Paginated<Customer>>("/api/customers/customers/"),
    apiGet<Paginated<Item>>("/api/catalog/items/"),
    apiGet<Paginated<Category>>("/api/catalog/categories/"),
    apiGet<Paginated<UOM>>("/api/catalog/uoms/"),
    apiGet<Paginated<Beat>>("/api/customers/beats/"),
    apiGet<Paginated<User>>("/api/users/"),
  ]);
  const agents = users.results.filter((u) => u.is_field_agent);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Master Data</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Customers and items — the data field agents bill against.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Customers ({customers.count})</h2>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Credit Limit</th>
                <th className="px-4 py-2 font-medium">Outstanding</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.results.map((c) => (
                <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">{c.code}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{c.name}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">₹{Number(c.credit_limit).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">₹{Number(c.outstanding_balance).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{c.is_blocked ? "Blocked" : c.credit_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CustomerForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Items ({items.count})</h2>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-4 py-2 font-medium">SKU</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">GST Rate</th>
                <th className="px-4 py-2 font-medium">Active</th>
              </tr>
            </thead>
            <tbody>
              {items.results.map((item) => (
                <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">{item.sku}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{item.name}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{item.gst_rate}%</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{item.is_active ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ItemForm categories={categories.results} uoms={uoms.results} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Routes / Beats ({beats.count})</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Assign each agent an ordered list of outlets to visit (FR-15 / AR-08). Feeds the Live Map's route-adherence view.
        </p>
        <div className="space-y-4">
          {beats.results.map((beat) => {
            const agent = agents.find((a) => a.id === beat.assigned_agent);
            return (
              <div key={beat.id} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{beat.name}</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {agent ? agent.first_name || agent.username : "Unassigned"}
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {[...beat.stops].sort((a, b) => a.visit_sequence - b.visit_sequence).map((stop) => (
                    <li key={stop.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 dark:text-slate-300">
                        <span className="mr-2 text-xs text-slate-400">#{stop.visit_sequence}</span>
                        {stop.customer_detail?.name}
                      </span>
                      <RemoveStopButton stopId={stop.id} />
                    </li>
                  ))}
                  {beat.stops.length === 0 && <li className="text-xs text-slate-400">No stops yet.</li>}
                </ul>
                <div className="mt-3">
                  <BeatStopForm beatId={beat.id} customers={customers.results} />
                </div>
              </div>
            );
          })}
          {beats.results.length === 0 && (
            <p className="text-sm text-slate-400">No routes yet — add one below.</p>
          )}
        </div>
        <BeatForm agents={agents} />
      </section>
    </div>
  );
}
