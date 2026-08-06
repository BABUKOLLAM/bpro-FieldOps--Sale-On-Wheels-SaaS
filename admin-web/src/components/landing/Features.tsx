const FEATURES = [
  {
    title: "Spot billing, on or offline",
    description:
      "GST-compliant tax invoices generated at the point of sale from van stock — full billing, orders, collections and returns work with zero connectivity.",
    icon: BillingIcon,
  },
  {
    title: "Real-time Tally Prime sync",
    description:
      "Every invoice, receipt, and credit note posts to Tally automatically, with duplicate-safe idempotent sync and a live monitor for any exceptions.",
    icon: SyncIcon,
  },
  {
    title: "Credit-limit control",
    description:
      "Outstanding balances and credit limits enforced at the point of sale, with a supervisor approval queue for anything over the line.",
    icon: ShieldIcon,
  },
  {
    title: "Live fleet & GPS tracking",
    description:
      "Trip start/end, odometer & fuel logs, maintenance schedules, and vehicle-level inventory — a fleet dashboard for every van on the road.",
    icon: TruckIcon,
  },
  {
    title: "Route & beat planning",
    description:
      "Assign outlet visit sequences per agent, track check-in/check-out, and see route adherence live from the back office.",
    icon: MapIcon,
  },
  {
    title: "Live back-office dashboard",
    description:
      "Today's sales, collections, active trips, and sync health in one screen — role-based access for supervisors, finance, and fleet managers.",
    icon: DashboardIcon,
  },
];

export default function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Built for the way field sales actually works
        </h2>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          Every feature below maps directly to a real field-ops problem — no generic CRM
          bolted onto a van.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ title, description, icon: Icon }) => (
          <div
            key={title}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Icon />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function iconProps() {
  return { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, className: "h-5 w-5" } as const;
}

function BillingIcon() {
  return (
    <svg {...iconProps()}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m-6 4h6m-6 4h4M6 3h9l3 3v15H6z" />
    </svg>
  );
}
function SyncIcon() {
  return (
    <svg {...iconProps()}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0114-4M20 15a8 8 0 01-14 4" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg {...iconProps()}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
    </svg>
  );
}
function TruckIcon() {
  return (
    <svg {...iconProps()}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 100-4 2 2 0 000 4zM18 19a2 2 0 100-4 2 2 0 000 4z" />
    </svg>
  );
}
function MapIcon() {
  return (
    <svg {...iconProps()}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-6-3V4l6 3 6-3 6 3v13l-6-3-6 3zM9 7v13M15 4v13" />
    </svg>
  );
}
function DashboardIcon() {
  return (
    <svg {...iconProps()}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 13h6V4H4zM14 20h6v-9h-6zM14 4v3h6V4zM4 20h6v-3H4z" />
    </svg>
  );
}
