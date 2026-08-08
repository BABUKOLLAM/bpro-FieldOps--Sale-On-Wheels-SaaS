import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-40 dark:opacity-25"
        style={{
          background:
            "radial-gradient(600px circle at 15% -10%, rgba(217,119,6,0.22), transparent 60%), radial-gradient(500px circle at 90% 10%, rgba(115,115,115,0.18), transparent 55%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-5 pb-14 pt-14 sm:px-6 sm:pb-20 sm:pt-20 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">
          Offline-first · GST-ready · Tally Prime sync
        </span>

        <h1 className="mx-auto mt-6 max-w-3xl font-[family-name:var(--font-archivo)] text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-5xl">
          Run your entire van sales fleet from one app
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-neutral-600 dark:text-neutral-300 sm:text-lg">
          Spot billing, orders, collections, returns and fleet tracking — fully offline on the
          road, synced in real time to Tally Prime and your back office the moment a signal
          comes back.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#calculator"
            className="w-full sm:w-auto rounded-lg bg-amber-500 px-6 py-3 text-sm font-semibold text-neutral-950 shadow-sm hover:bg-amber-400"
          >
            Estimate your price
          </a>
          <Link
            href="/login"
            className="w-full sm:w-auto rounded-lg border border-neutral-300 dark:border-neutral-700 px-6 py-3 text-sm font-semibold text-neutral-800 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-900"
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
              <dt className="font-[family-name:var(--font-archivo)] text-2xl font-bold text-neutral-900 dark:text-white sm:text-3xl">
                {stat}
              </dt>
              <dd className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 sm:text-sm">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
