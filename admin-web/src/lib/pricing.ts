/**
 * Pricing model, ported 1:1 from Customer_Pricing_Calculator.xlsx
 * ("Rate Card" + "Pricing Calculator" sheets). Keep this in sync with the
 * spreadsheet — it is the source of truth for these numbers.
 *
 * Model: one-time Setup Fee + recurring per-agent monthly Subscription,
 * with Hosting shown separately. Rates are banded by deployment size
 * (agent/van count) and feature tier.
 */

export type Tier = "Basic" | "Standard" | "Premium";
export type Band = "Small" | "Large" | "Medium";

export const TIERS: Tier[] = ["Basic", "Standard", "Premium"];

export const SIZE_BANDS: { band: Band; min: number; max: number }[] = [
  { band: "Small", min: 1, max: 25 },
  { band: "Medium", min: 26, max: 100 },
  { band: "Large", min: 101, max: 250 },
];

export const ENTERPRISE_THRESHOLD = 250;

type RateCardRow = {
  band: Band;
  tier: Tier;
  setupFee: number;
  perAgentMonthly: number;
  hostingMonthly: number;
};

// Rate Card sheet, rows 5-13.
export const RATE_CARD: RateCardRow[] = [
  { band: "Small", tier: "Basic", setupFee: 150000, perAgentMonthly: 800, hostingMonthly: 10000 },
  { band: "Small", tier: "Standard", setupFee: 200000, perAgentMonthly: 1300, hostingMonthly: 10000 },
  { band: "Small", tier: "Premium", setupFee: 300000, perAgentMonthly: 1900, hostingMonthly: 10000 },
  { band: "Medium", tier: "Basic", setupFee: 250000, perAgentMonthly: 650, hostingMonthly: 30000 },
  { band: "Medium", tier: "Standard", setupFee: 350000, perAgentMonthly: 1100, hostingMonthly: 30000 },
  { band: "Medium", tier: "Premium", setupFee: 500000, perAgentMonthly: 1600, hostingMonthly: 30000 },
  { band: "Large", tier: "Basic", setupFee: 400000, perAgentMonthly: 550, hostingMonthly: 75000 },
  { band: "Large", tier: "Standard", setupFee: 600000, perAgentMonthly: 950, hostingMonthly: 75000 },
  { band: "Large", tier: "Premium", setupFee: 900000, perAgentMonthly: 1350, hostingMonthly: 75000 },
];

export const TIER_FEATURES: Record<Tier, string[]> = {
  Basic: [
    "Spot billing, sales orders, collections & returns",
    "Full offline mode with background sync",
    "Admin dashboard & core reports",
    "Tally Prime batch sync (masters + transactions)",
    "Core fleet: trips, vehicle tracking, odometer, fuel, inventory",
  ],
  Standard: [
    "Everything in Basic, plus:",
    "Real-time GPS tracking & route/beat optimization",
    "Scheme & discount engine, digital signature capture",
    "Expense tracking with approval workflow",
    "Full fleet management (maintenance, reverse logistics, fleet dashboard)",
  ],
  Premium: [
    "Everything in Standard, plus:",
    "Generic multi-ERP API layer + Busy / Marg integration",
    "Online UPI / card payment collection",
    "Target vs. achievement analytics, multi-language UI",
    "Advanced fleet: geofencing, driver safety scoring, telematics/OBD-II",
  ],
};

export function bandForAgents(agents: number): Band | null {
  if (agents > ENTERPRISE_THRESHOLD) return null;
  const match = SIZE_BANDS.find((b) => agents >= b.min && agents <= b.max);
  return match ? match.band : null;
}

export function rateFor(tier: Tier, band: Band): RateCardRow {
  const row = RATE_CARD.find((r) => r.tier === tier && r.band === band);
  if (!row) throw new Error(`No rate card entry for ${tier}/${band}`);
  return row;
}

export type PricingResult = {
  band: Band;
  setupFee: number;
  perAgentMonthly: number;
  monthlySubscription: number;
  hostingMonthly: number;
  totalMonthlyRecurring: number;
  annualRecurringValue: number;
  year1TotalContractValue: number;
  effectiveCostPerAgentPerMonth: number;
};

/** Mirrors the "COMPUTED" + "PRICING OUTPUT" sections of the Pricing
 * Calculator sheet. Returns null once agent count exceeds the rate
 * card's range (custom enterprise quote territory — B22's note). */
export function calculatePricing(agents: number, tier: Tier): PricingResult | null {
  const band = bandForAgents(agents);
  if (!band || agents < 1) return null;

  const rate = rateFor(tier, band);
  const monthlySubscription = agents * rate.perAgentMonthly;
  const totalMonthlyRecurring = monthlySubscription + rate.hostingMonthly;
  const annualRecurringValue = totalMonthlyRecurring * 12;
  const year1TotalContractValue = rate.setupFee + annualRecurringValue;
  const effectiveCostPerAgentPerMonth = totalMonthlyRecurring / agents;

  return {
    band,
    setupFee: rate.setupFee,
    perAgentMonthly: rate.perAgentMonthly,
    monthlySubscription,
    hostingMonthly: rate.hostingMonthly,
    totalMonthlyRecurring,
    annualRecurringValue,
    year1TotalContractValue,
    effectiveCostPerAgentPerMonth,
  };
}

/** Indian digit grouping (₹3,50,000 not ₹350,000). */
export function formatINR(amount: number): string {
  const rounded = Math.round(amount);
  return `₹${rounded.toLocaleString("en-IN")}`;
}
