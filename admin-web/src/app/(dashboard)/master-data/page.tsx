import { apiGet } from "@/lib/api";
import CustomerForm from "./CustomerForm";
import ItemForm from "./ItemForm";

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

export default async function MasterDataPage() {
  const [customers, items, categories, uoms] = await Promise.all([
    apiGet<Paginated<Customer>>("/api/customers/customers/"),
    apiGet<Paginated<Item>>("/api/catalog/items/"),
    apiGet<Paginated<Category>>("/api/catalog/categories/"),
    apiGet<Paginated<UOM>>("/api/catalog/uoms/"),
  ]);

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
    </div>
  );
}
