import { apiGet } from "@/lib/api";
import ApproveCreditButton from "./ApproveCreditButton";
import ExpenseApproveButton from "./ExpenseApproveButton";
import ExpenseRejectButton from "./ExpenseRejectButton";
import SyncActions from "./SyncActions";

type Paginated<T> = { count: number; results: T[] };

type PendingInvoice = {
  id: string;
  invoice_no: string;
  customer: string;
  grand_total: string;
  credit_check_status: string;
};

type SyncLogEntry = {
  id: string;
  entity_type: string;
  local_object_id: string;
  erp_reference_id: string;
  status: string;
  retry_count: number;
  error_message: string;
  updated_at: string;
};

type PendingExpense = {
  id: string;
  agent: string;
  category: string;
  amount: string;
  description: string;
  expense_date: string;
};

export default async function ApprovalsPage() {
  const [pendingInvoices, syncLog, pendingExpenses] = await Promise.all([
    apiGet<Paginated<PendingInvoice>>("/api/sales/invoices/?credit_check_status=pending_review"),
    apiGet<Paginated<SyncLogEntry>>("/api/integrations/sync-log/"),
    apiGet<Paginated<PendingExpense>>("/api/expenses/?status=submitted"),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Approvals &amp; Sync Monitor</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Credit-blocked invoices and field expenses awaiting supervisor approval, and the Tally sync health of every transaction.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Credit-Block Approval Queue ({pendingInvoices.count})
        </h2>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-4 py-2 font-medium">Invoice</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {pendingInvoices.results.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    Nothing pending review.
                  </td>
                </tr>
              )}
              {pendingInvoices.results.map((inv) => (
                <tr key={inv.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">{inv.invoice_no || inv.id.slice(0, 8)}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">₹{Number(inv.grand_total).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2">
                    <span className="inline-block rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                      pending review
                    </span>
                  </td>
                  <td className="px-4 py-2"><ApproveCreditButton invoiceId={inv.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Expense Approvals ({pendingExpenses.count})
        </h2>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {pendingExpenses.results.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Nothing pending review.
                  </td>
                </tr>
              )}
              {pendingExpenses.results.map((exp) => (
                <tr key={exp.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 capitalize text-slate-700 dark:text-slate-300">{exp.category}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">₹{Number(exp.amount).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{exp.expense_date}</td>
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{exp.description || "—"}</td>
                  <td className="px-4 py-2 space-x-2 whitespace-nowrap">
                    <ExpenseApproveButton expenseId={exp.id} />
                    <ExpenseRejectButton expenseId={exp.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Integration Sync Monitor ({syncLog.count})
        </h2>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-4 py-2 font-medium">Entity</th>
                <th className="px-4 py-2 font-medium">Reference</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Retries</th>
                <th className="px-4 py-2 font-medium">Error</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {syncLog.results.map((entry) => (
                <tr key={entry.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{entry.entity_type}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">{entry.erp_reference_id || "—"}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{entry.status}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{entry.retry_count}</td>
                  <td className="px-4 py-2 max-w-xs truncate text-xs text-red-600 dark:text-red-400">{entry.error_message}</td>
                  <td className="px-4 py-2"><SyncActions entryId={entry.id} status={entry.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
