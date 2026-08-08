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
                ? "border-amber-500 bg-white dark:bg-neutral-900 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500"
                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
            }`}
          >
            {popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-neutral-900 dark:bg-amber-500 px-3 py-1 text-xs font-semibold text-amber-400 dark:text-neutral-950">
                Most popular
              </span>
            )}
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">{tier}</h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {tier === "Basic" && "Get live fast with the core field-sales workflow."}
              {tier === "Standard" && "Add real-time visibility, routing, and full fleet ops."}
              {tier === "Premium" && "Multi-ERP, payments, and advanced fleet intelligence."}
            </p>

            <div className="mt-5">
              <span className="font-[family-name:var(--font-archivo)] text-3xl font-bold text-neutral-900 dark:text-white">
                {formatINR(rate.perAgentMonthly)}
              </span>
              <span className="text-sm text-neutral-500 dark:text-neutral-400"> / agent / month</span>
              <p className="mt-1 text-xs text-neutral-400">
                + {formatINR(rate.setupFee)} one-time setup · from a {formatINR(rate.hostingMonthly)}/mo hosting
                (up to 25 agents)
              </p>
            </div>

            <ul className="mt-6 space-y-2.5 text-sm text-neutral-600 dark:text-neutral-300 flex-1">
              {TIER_FEATURES[tier].map((feature) => (
                <li key={feature} className="flex gap-2">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400">
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
                  ? "bg-amber-500 text-neutral-950 hover:bg-amber-400"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700"
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
