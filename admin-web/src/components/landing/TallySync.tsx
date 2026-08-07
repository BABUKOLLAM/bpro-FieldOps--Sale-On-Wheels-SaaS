const OFFLINE_STEPS = [
  {
    title: "Bill offline",
    description: "Orders, billing, and collections work with zero signal — nothing waits on connectivity.",
  },
  {
    title: "Store securely on device",
    description: "Every transaction is saved locally the instant it's created, so nothing is ever lost.",
  },
  {
    title: "Auto-sync in the background",
    description: "The moment the connection returns, everything pushes to Tally on its own — no manual step.",
  },
];

const MASTERS_IN = ["Customer details", "Price lists", "Stock items", "Tax details", "Credit limits"];
const TRANSACTIONS_OUT = ["Sales invoices", "Orders", "Receipt vouchers", "Sales returns", "Van stock transfers"];

export default function TallySync() {
  return (
    <section className="bg-slate-50 dark:bg-slate-900/40 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Never enter the same data twice
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            Masters flow from Tally into the field app; transactions flow back — no duplicate entry, in
            either direction.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {OFFLINE_STEPS.map((step, i) => (
            <div key={step.title} className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                {i + 1}
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">{step.title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{step.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8">
          <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto_1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Tally Prime → Field App
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">Masters, pulled in</p>
              <ul className="mt-3 space-y-1.5">
                {MASTERS_IN.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-center text-slate-300 dark:text-slate-700">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-8 w-8 rotate-90 sm:rotate-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0114-4M20 15a8 8 0 01-14 4" />
              </svg>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Field App → Tally Prime
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">Transactions, pushed out</p>
              <ul className="mt-3 space-y-1.5">
                {TRANSACTIONS_OUT.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
