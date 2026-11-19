import IconChip from "@/components/icons/IconChip";
import type { Accent, IconName } from "@/components/icons/registry";
const FEATURES = [
  {
    title: "Spot billing, on or offline",
    description:
      "GST-compliant tax invoices generated at the point of sale from van stock — full billing, orders, collections and returns work with zero connectivity.",
    icon: "invoices" as IconName,
    accent: "money" as Accent,
  },
  {
    title: "Real-time Tally Prime sync",
    description:
      "Every invoice, receipt, and credit note posts to Tally automatically, with duplicate-safe idempotent sync and a live monitor for any exceptions.",
    icon: "sync" as IconName,
    accent: "brand" as Accent,
  },
  {
    title: "Credit-limit control",
    description:
      "Outstanding balances and credit limits enforced at the point of sale, with a supervisor approval queue for anything over the line.",
    icon: "approvals" as IconName,
    accent: "people" as Accent,
  },
  {
    title: "Live fleet & GPS tracking",
    description:
      "Trip start/end, odometer & fuel logs, maintenance schedules, and vehicle-level inventory — a fleet dashboard for every van on the road.",
    icon: "fleet" as IconName,
    accent: "fleet" as Accent,
  },
  {
    title: "Route & beat planning",
    description:
      "Assign outlet visit sequences per agent, track check-in/check-out, and see route adherence live from the back office.",
    icon: "route" as IconName,
    accent: "sales" as Accent,
  },
  {
    title: "Live back-office dashboard",
    description:
      "Today's sales, collections, active trips, and sync health in one screen — role-based access for supervisors, finance, and fleet managers.",
    icon: "dashboard" as IconName,
    accent: "brand" as Accent,
  },
  {
    title: "Fraud & anomaly detection",
    description:
      "Statistical outlier alerts on the day's headline numbers, plus rule-based checks for discount abuse, return patterns, and GPS-spoofed check-ins — explainable, not a black box.",
    icon: "fraud" as IconName,
    accent: "alerts" as Accent,
  },
  {
    title: "Governed back-office changes",
    description:
      "Sensitive settings — roles, GST details, payment gateways, integrations — go through a propose-and-approve workflow instead of a direct edit, with a full audit trail.",
    icon: "governed" as IconName,
    accent: "settings" as Accent,
  },
];

export default function Features() {
  return (
    <section id="features" className="bg-neutral-50 dark:bg-neutral-900/40 py-14 sm:py-20">
    <div className="mx-auto max-w-6xl px-5 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-[family-name:var(--font-archivo)] text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Built for the way field sales actually works
        </h2>
        <p className="mt-3 text-neutral-600 dark:text-neutral-300">
          Every feature below maps directly to a real field-ops problem — no generic CRM
          bolted onto a van.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ title, description, icon, accent }, i) => (
          <div
            key={title}
            className="ic-host ic-rise rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6"
            style={{ "--ic-i": i } as React.CSSProperties}
          >
            <IconChip name={icon} accent={accent} size="lg" />
            <h3 className="mt-4 text-base font-semibold text-neutral-900 dark:text-white">{title}</h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{description}</p>
          </div>
        ))}
      </div>
    </div>
    </section>
  );
}
