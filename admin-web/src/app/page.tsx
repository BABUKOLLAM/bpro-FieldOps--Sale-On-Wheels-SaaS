import { isAuthenticated } from "@/lib/api";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import PricingTiers from "@/components/landing/PricingTiers";
import PricingCalculator from "@/components/landing/PricingCalculator";
import Footer from "@/components/landing/Footer";

export default async function Home() {
  const authenticated = await isAuthenticated();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <Header authenticated={authenticated} />
      <main>
        <Hero />
        <Features />

        <section id="pricing" className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Simple, size-based pricing
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              One-time setup + a per-agent monthly subscription. Hosting shown separately, scaled
              to your deployment size.
            </p>
          </div>
          <div className="mt-12">
            <PricingTiers />
          </div>
        </section>

        <section id="calculator" className="mx-auto max-w-6xl px-5 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Get an exact number for your fleet
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              Move the slider to your agent count and pick a tier — pricing updates instantly.
            </p>
          </div>
          <div className="mt-10">
            <PricingCalculator />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
