import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-40 dark:opacity-30"
        style={{
          background:
            "radial-gradient(600px circle at 15% -10%, rgba(99,102,241,0.25), transparent 60%), radial-gradient(500px circle at 90% 10%, rgba(139,92,246,0.20), transparent 55%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-5 pb-14 pt-14 sm:px-6 sm:pb-20 sm:pt-20 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 dark:border-violet-900 bg-violet-50 dark:bg-violet-950/50 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300">
          Offline-first · GST-ready · Tally Prime sync
        </span>

        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
          Run your entire van sales fleet from one app
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 dark:text-slate-300 sm:text-lg">
          Spot billing, orders, collections, returns and fleet tracking — fully offline on the
          road, synced in real time to Tally Prime and your back office the moment a signal
          comes back.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#calculator"
            className="w-full sm:w-auto rounded-lg bg-linear-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
          >
            Estimate your price
          </a>
          <Link
            href="/login"
            className="w-full sm:w-auto rounded-lg border border-slate-300 dark:border-slate-700 px-6 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900"
          >
            Sign in to your workspace
          </Link>
        </div>

        <dl className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-4 text-center">
          {[
            ["100%", "Offline billing"],
            ["9", "Fleet & GPS features"],
            ["₹", "GST-compliant invoicing"],
          ].map(([stat, label]) => (
            <div key={label}>
              <dt className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">{stat}</dt>
              <dd className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
