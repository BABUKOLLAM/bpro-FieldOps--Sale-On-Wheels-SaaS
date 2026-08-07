import { formatINR, rateFor, TIER_FEATURES, TIERS } from "@/lib/pricing";

export default function PricingTiers() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {TIERS.map((tier) => {
        const rate = rateFor(tier, "Small");
        const popular = tier === "Standard";
        return (
          <div
            key={tier}
            className={`relative flex flex-col rounded-2xl border p-6 sm:p-7 ${
              popular
                ? "border-violet-600 bg-white dark:bg-slate-900 shadow-lg shadow-violet-600/10 ring-1 ring-violet-600"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            }`}
          >
            {popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-linear-to-r from-indigo-600 to-violet-600 px-3 py-1 text-xs font-semibold text-white">
                Most popular
              </span>
            )}
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{tier}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {tier === "Basic" && "Get live fast with the core field-sales workflow."}
              {tier === "Standard" && "Add real-time visibility, routing, and full fleet ops."}
              {tier === "Premium" && "Multi-ERP, payments, and advanced fleet intelligence."}
            </p>

            <div className="mt-5">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">
                {formatINR(rate.perAgentMonthly)}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400"> / agent / month</span>
              <p className="mt-1 text-xs text-slate-400">
                + {formatINR(rate.setupFee)} one-time setup · from a {formatINR(rate.hostingMonthly)}/mo hosting
                (up to 25 agents)
              </p>
            </div>

            <ul className="mt-6 space-y-2.5 text-sm text-slate-600 dark:text-slate-300 flex-1">
              {TIER_FEATURES[tier].map((feature) => (
                <li key={feature} className="flex gap-2">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-violet-500">
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <a
              href="#calculator"
              className={`mt-6 block rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                popular
                  ? "bg-linear-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              Estimate my price
            </a>
          </div>
        );
      })}
    </div>
  );
}
