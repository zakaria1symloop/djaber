import PricingSection from '@/components/PricingSection';

export default function PricingPage() {
  return (
    <main className="min-h-screen pt-28">
      <section className="relative py-16 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1
              className="text-4xl sm:text-5xl font-bold text-white mb-4"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Simple Pricing
            </h1>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              Choose the plan that fits your business
            </p>
          </div>
          <PricingSection />
        </div>
      </section>
    </main>
  );
}
