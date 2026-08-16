import { apiGet } from "@/lib/api";
import CustomerForm from "./CustomerForm";
import ItemForm from "./ItemForm";
import BeatForm from "./BeatForm";
import BeatStopForm from "./BeatStopForm";
import RemoveStopButton from "./RemoveStopButton";
import OptimizeRouteButton from "./OptimizeRouteButton";
import BeatTemplateForm from "./BeatTemplateForm";
import BeatTemplateStopForm from "./BeatTemplateStopForm";
import RemoveTemplateStopButton from "./RemoveTemplateStopButton";
import InstantiateTemplateForm from "./InstantiateTemplateForm";
import { CARD_CLASS } from "@/components/ui/Card";

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

type BeatTemplateStop = {
  id: string;
  template: string;
  customer: string;
  customer_detail: Customer;
  visit_sequence: number;
};

type BeatTemplate = {
  id: string;
  name: string;
  is_active: boolean;
  stops: BeatTemplateStop[];
};

export default async function MasterDataPage() {
  const [customers, items, categories, uoms, beats, users, beatTemplates] = await Promise.all([
    apiGet<Paginated<Customer>>("/api/customers/customers/"),
    apiGet<Paginated<Item>>("/api/catalog/items/"),
    apiGet<Paginated<Category>>("/api/catalog/categories/"),
    apiGet<Paginated<UOM>>("/api/catalog/uoms/"),
    apiGet<Paginated<Beat>>("/api/customers/beats/"),
    apiGet<Paginated<User>>("/api/users/"),
    apiGet<Paginated<BeatTemplate>>("/api/customers/beat-templates/"),
  ]);
  const agents = users.results.filter((u) => u.is_field_agent);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Master Data</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Customers and items — the data field agents bill against.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Customers ({customers.count})</h2>
        <div className={`${CARD_CLASS} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Credit Limit</th>
                <th className="px-4 py-2 font-medium">Outstanding</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.results.map((c) => (
                <tr key={c.id} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="px-4 py-2 font-mono text-xs text-neutral-700 dark:text-neutral-300">{c.code}</td>
                  <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">{c.name}</td>
                  <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">₹{Number(c.credit_limit).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">₹{Number(c.outstanding_balance).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">{c.is_blocked ? "Blocked" : c.credit_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CustomerForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Items ({items.count})</h2>
        <div className={`${CARD_CLASS} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                <th className="px-4 py-2 font-medium">SKU</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">GST Rate</th>
                <th className="px-4 py-2 font-medium">Active</th>
              </tr>
            </thead>
            <tbody>
              {items.results.map((item) => (
                <tr key={item.id} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="px-4 py-2 font-mono text-xs text-neutral-700 dark:text-neutral-300">{item.sku}</td>
                  <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">{item.name}</td>
                  <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">{item.gst_rate}%</td>
                  <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">{item.is_active ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ItemForm categories={categories.results} uoms={uoms.results} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Routes / Beats ({beats.count})</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Assign each agent an ordered list of outlets to visit (FR-15 / AR-08). Feeds the Live Map&apos;s route-adherence view.
        </p>
        <div className="space-y-4">
          {beats.results.map((beat) => {
            const agent = agents.find((a) => a.id === beat.assigned_agent);
            return (
              <div key={beat.id} className={`${CARD_CLASS} p-4`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{beat.name}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {agent ? agent.first_name || agent.username : "Unassigned"}
                    </span>
                    {beat.stops.length > 1 && <OptimizeRouteButton beatId={beat.id} />}
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {[...beat.stops].sort((a, b) => a.visit_sequence - b.visit_sequence).map((stop) => (
                    <li key={stop.id} className="flex items-center justify-between text-sm">
                      <span className="text-neutral-700 dark:text-neutral-300">
                        <span className="mr-2 text-xs text-neutral-400">#{stop.visit_sequence}</span>
                        {stop.customer_detail?.name}
                      </span>
                      <RemoveStopButton stopId={stop.id} />
                    </li>
                  ))}
                  {beat.stops.length === 0 && <li className="text-xs text-neutral-400">No stops yet.</li>}
                </ul>
                <div className="mt-3">
                  <BeatStopForm beatId={beat.id} customers={customers.results} />
                </div>
              </div>
            );
          })}
          {beats.results.length === 0 && (
            <p className="text-sm text-neutral-400">No routes yet — add one below.</p>
          )}
        </div>
        <BeatForm agents={agents} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Trip Plan Templates ({beatTemplates.count})
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          A reusable outlet list, not yet assigned to any agent or day — instantiate one into a brand-new route
          above without affecting the template itself.
        </p>
        <div className="space-y-4">
          {beatTemplates.results.map((template) => (
            <div key={template.id} className={`${CARD_CLASS} p-4`}>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{template.name}</h3>
              <ul className="mt-3 space-y-1.5">
                {[...template.stops].sort((a, b) => a.visit_sequence - b.visit_sequence).map((stop) => (
                  <li key={stop.id} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-700 dark:text-neutral-300">
                      <span className="mr-2 text-xs text-neutral-400">#{stop.visit_sequence}</span>
                      {stop.customer_detail?.name}
                    </span>
                    <RemoveTemplateStopButton stopId={stop.id} />
                  </li>
                ))}
                {template.stops.length === 0 && <li className="text-xs text-neutral-400">No stops yet.</li>}
              </ul>
              <div className="mt-3">
                <BeatTemplateStopForm templateId={template.id} customers={customers.results} />
              </div>
              <div className="mt-3 border-t border-neutral-100 dark:border-neutral-800 pt-3">
                <InstantiateTemplateForm templateId={template.id} agents={agents} />
              </div>
            </div>
          ))}
          {beatTemplates.results.length === 0 && (
            <p className="text-sm text-neutral-400">No trip plan templates yet — add one below.</p>
          )}
        </div>
        <BeatTemplateForm />
      </section>
    </div>
  );
}
