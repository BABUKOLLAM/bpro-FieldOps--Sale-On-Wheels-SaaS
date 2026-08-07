const PHASES = [
  {
    label: "Phase 1 — Now",
    title: "Core field sales",
    items: ["Spot billing, orders & collections", "Sales returns", "Tally Prime sync", "Admin dashboard"],
    current: true,
  },
  {
    label: "Phase 2",
    title: "Expansion",
    items: ["Live GPS & route tracking", "Expense management", "Scheme & discount engine", "Barcode scanning"],
    current: false,
  },
  {
    label: "Phase 3",
    title: "New systems",
    items: ["Other ERPs — Busy, Marg, SAP", "UPI & card payments"],
    current: false,
  },
];

const METRICS = [
  { value: "Minutes, not days", label: "Field sales reflected in Tally", color: "text-violet-600 dark:text-violet-400" },
  { value: "99%", label: "Billing accuracy, errors designed out", color: "text-emerald-600 dark:text-emerald-400" },
  { value: "Lower DSO", label: "Outstanding tracked and collected faster", color: "text-sky-600 dark:text-sky-400" },
];

export default function Roadmap() {
  return (
    <section className="bg-slate-50 dark:bg-slate-900/40 py-14 sm:py-20">
    <div className="mx-auto max-w-6xl px-5 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Grows with your business
        </h2>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          Tally Prime is today&apos;s foundation, not a ceiling — the platform is built to extend to other
          accounting systems and payment rails as you need them.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {PHASES.map((phase) => (
          <div
            key={phase.label}
            className={`rounded-xl border p-6 ${
              phase.current
                ? "border-violet-300 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            }`}
          >
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                phase.current
                  ? "bg-violet-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              }`}
            >
              {phase.label}
            </span>
            <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">{phase.title}</h3>
            <ul className="mt-3 space-y-1.5">
              {phase.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:grid-cols-3">
        {METRICS.map((m) => (
          <div key={m.label} className="text-center">
            <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
    </section>
  );
}
