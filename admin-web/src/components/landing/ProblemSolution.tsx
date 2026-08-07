const ROWS = [
  {
    problem: "Bills written by hand, entered into Tally days later — errors and delays compound.",
    solution: "Spot billing on the phone at the counter, GST-correct, synced to Tally same day.",
  },
  {
    problem: "No one knows a customer's real outstanding until the ledger is manually checked.",
    solution: "Credit limit and outstanding balance shown before every sale — over-limit needs approval.",
  },
  {
    problem: "Beat routes exist on paper, if at all — visit order and coverage are guesswork.",
    solution: "Every agent gets an ordered route; the back office sees adherence live on a map.",
  },
  {
    problem: "Van stock is counted by hand at day-end, out of step with the books.",
    solution: "Every sale, return, and transfer updates stock in real time, van and warehouse alike.",
  },
];

export default function ProblemSolution() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          The gap between the field and the books
        </h2>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          Paper-based van sales creates four recurring problems. Here&apos;s what changes.
        </p>
      </div>

      <div className="mt-12 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-2 bg-slate-50 dark:bg-slate-900 text-sm font-semibold text-slate-500 dark:text-slate-400">
          <div className="px-5 py-3 border-r border-slate-200 dark:border-slate-800">Without a system</div>
          <div className="px-5 py-3 text-indigo-600 dark:text-indigo-400">With this platform</div>
        </div>
        {ROWS.map((row, i) => (
          <div
            key={i}
            className={`grid grid-cols-2 text-sm ${i > 0 ? "border-t border-slate-200 dark:border-slate-800" : ""}`}
          >
            <div className="px-5 py-4 border-r border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
              {row.problem}
            </div>
            <div className="px-5 py-4 bg-indigo-50/40 dark:bg-indigo-950/20 text-slate-800 dark:text-slate-100">
              {row.solution}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
