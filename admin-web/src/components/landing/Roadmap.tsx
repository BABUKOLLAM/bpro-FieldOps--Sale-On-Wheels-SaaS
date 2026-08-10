const CAPABILITIES = [
  {
    title: "Field Sales & Billing",
    items: [
      "Offline spot billing, orders, collections & returns",
      "GST-compliant invoice PDFs + e-way bill generation",
      "UPI QR at the point of sale",
      "Digital signature & OTP proof-of-delivery",
      "Scheme & discount engine (slab, volume, buy-X-get-Y)",
    ],
  },
  {
    title: "Fleet & Route Intelligence",
    items: [
      "Live GPS tracking & route/beat optimization",
      "Trip cost & profitability analysis",
      "Driver safety scoring, idle-time & route-deviation analytics",
      "Maintenance schedules & reverse logistics",
      "Barcode scanning, Bluetooth receipt printing",
    ],
  },
  {
    title: "Back-Office, Compliance & Insights",
    items: [
      "Role-based access with governed change-request approvals",
      "Master Settings hub — company, GST, integrations, payments",
      "Bulk master-data import/export with per-row error reports",
      "Alerts & exception reporting — variance, missed visits, inactivity",
      "AI dashboard anomaly insights & rule-based fraud detection",
    ],
  },
  {
    title: "Integrations & Payments",
    items: [
      "Real-time Tally Prime sync, plus Busy & Marg connectors",
      "Generic multi-ERP API/webhook layer for anything else",
      "UPI & card payment collection at the point of sale",
      "WhatsApp, push, and SMS delivery notifications",
      "Multi-language UI",
    ],
  },
];

const NEXT_UP = [
  "Third-party GPS/telematics hardware integration, once you've picked a vendor",
  "Geofencing beyond zone-based alerts",
  "Excel/PDF/email export for the Fleet Dashboard specifically (every other report already has it)",
];

const METRICS = [
  { value: "Minutes, not days", label: "Field sales reflected in Tally", color: "text-amber-600 dark:text-amber-400" },
  { value: "99%", label: "Billing accuracy, errors designed out", color: "text-neutral-700 dark:text-neutral-300" },
  { value: "Lower DSO", label: "Outstanding tracked and collected faster", color: "text-red-600 dark:text-red-400" },
];

export default function Roadmap() {
  return (
    <section className="bg-neutral-50 dark:bg-neutral-900/40 py-14 sm:py-20">
    <div className="mx-auto max-w-6xl px-5 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-[family-name:var(--font-archivo)] text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Everything shipped, not a slide deck
        </h2>
        <p className="mt-3 text-neutral-600 dark:text-neutral-300">
          Tally Prime was the starting point — the platform has grown well past field sales into fleet
          intelligence, compliance, and fraud detection. All of it below is built and running today.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {CAPABILITIES.map((group) => (
          <div
            key={group.title}
            className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6"
          >
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white">{group.title}</h3>
            <ul className="mt-3 space-y-1.5">
              {group.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          What&apos;s next
        </p>
        <ul className="mt-2 space-y-1">
          {NEXT_UP.map((item) => (
            <li key={item} className="text-sm text-neutral-600 dark:text-neutral-300">
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10 grid gap-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 sm:grid-cols-3">
        {METRICS.map((m) => (
          <div key={m.label} className="text-center">
            <p className={`font-[family-name:var(--font-archivo)] text-2xl font-bold ${m.color}`}>{m.value}</p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
    </section>
  );
}
