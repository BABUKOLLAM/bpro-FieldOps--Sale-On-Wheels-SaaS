"use client";

import { useMemo, useState } from "react";
import { calculatePricing, ENTERPRISE_THRESHOLD, formatINR, TIERS, type Tier } from "@/lib/pricing";

export default function PricingCalculator() {
  const [agents, setAgents] = useState(50);
  const [tier, setTier] = useState<Tier>("Standard");

  const result = useMemo(() => calculatePricing(agents, tier), [agents, tier]);
  const isEnterprise = agents > ENTERPRISE_THRESHOLD;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-5">
        {/* Inputs */}
        <div className="lg:col-span-2 p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            Estimate your price
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Same logic as our internal rate card — instant, no sales call needed.
          </p>

          <div className="mt-6">
            <div className="flex items-baseline justify-between">
              <label htmlFor="agents" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Field agents / vans
              </label>
              <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{agents}</span>
            </div>
            <input
              id="agents"
              type="range"
              min={1}
              max={300}
              value={agents}
              onChange={(e) => setAgents(Number(e.target.value))}
              className="mt-3 w-full accent-indigo-600"
            />
            <div className="mt-2 flex justify-between text-xs text-slate-400">
              <span>1</span>
              <span>250 (rate card max)</span>
              <span>300</span>
            </div>
            <input
              type="number"
              min={1}
              value={agents}
              onChange={(e) => setAgents(Math.max(1, Number(e.target.value) || 1))}
              className="mt-3 w-32 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="mt-6">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Feature tier</span>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {TIERS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    tier === t
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Output */}
        <div className="lg:col-span-3 p-6 sm:p-8">
          {isEnterprise || !result ? (
            <div className="flex h-full flex-col items-center justify-center text-center py-10">
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                Deployment exceeds the standard rate card ({ENTERPRISE_THRESHOLD} agents)
              </p>
              <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                At this scale we put together a custom enterprise quote with volume pricing and
                dedicated hosting sizing. Talk to us and we&apos;ll get you a number within a day.
              </p>
              <a
                href="mailto:tech@bpropms.com?subject=Enterprise%20quote%20request%20-%20Van%20Sales"
                className="mt-5 rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Request enterprise quote
              </a>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                  {result.band} deployment
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {agents} agent{agents === 1 ? "" : "s"} · {tier} tier
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4">
                <Stat label="One-time setup fee" value={formatINR(result.setupFee)} />
                <Stat label="Per-agent / month" value={formatINR(result.perAgentMonthly)} />
                <Stat label="Subscription (all agents)" value={formatINR(result.monthlySubscription)} sub="/ month" />
                <Stat label="Hosting" value={formatINR(result.hostingMonthly)} sub="/ month" />
              </div>

              <div className="mt-5 rounded-xl bg-slate-900 dark:bg-slate-950 p-5 text-white">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-slate-300">Total monthly recurring</span>
                  <span className="text-2xl font-bold tabular-nums">{formatINR(result.totalMonthlyRecurring)}</span>
                </div>
                <div className="mt-3 flex items-baseline justify-between border-t border-white/10 pt-3">
                  <span className="text-sm text-slate-300">Year 1 total contract value</span>
                  <span className="text-xl font-semibold tabular-nums">
                    {formatINR(result.year1TotalContractValue)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">Setup fee + 12 months of subscription &amp; hosting</p>
              </div>

              <p className="mt-4 text-xs text-slate-400">
                Effective all-in cost: {formatINR(result.effectiveCostPerAgentPerMonth)} per agent per month.
                Figures are planning estimates in INR — final pricing confirmed at proposal stage.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white tabular-nums">
        {value}
        {sub && <span className="ml-1 text-xs font-normal text-slate-400">{sub}</span>}
      </p>
    </div>
  );
}
