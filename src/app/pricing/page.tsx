import Link from 'next/link';

export default function PricingPage() {
  return (
    <main className="min-h-screen pt-20">
      <section className="relative py-32 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h1
              className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Simple <span className="gradient-text">Pricing</span>
            </h1>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
              Choose the plan that fits your business. All plans include 14-day free trial.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-20">
            {[
              {
                name: 'Starter',
                price: '49',
                description: 'Perfect for small businesses',
                features: [
                  '1 Facebook/Instagram page',
                  '1,000 messages/month',
                  'Basic AI training',
                  'Email support',
                  'Analytics dashboard',
                  'Multi-language support'
                ],
                popular: false
              },
              {
                name: 'Pro',
                price: '149',
                description: 'Most popular for growing brands',
                features: [
                  '5 Facebook/Instagram pages',
                  '10,000 messages/month',
                  'Advanced AI training',
                  'Priority support',
                  'Advanced analytics',
                  'Custom responses',
                  'Team collaboration',
                  'API access'
                ],
                popular: true
              },
              {
                name: 'Enterprise',
                price: 'Custom',
                description: 'For large organizations',
                features: [
                  'Unlimited pages',
                  'Unlimited messages',
                  'White-label solution',
                  'Dedicated support',
                  'Custom integrations',
                  'SLA guarantee',
                  'Training & onboarding',
                  'Custom AI models'
                ],
                popular: false
              },
            ].map((plan, index) => (
              <div
                key={index}
                className={`relative p-8 rounded-2xl border ${
                  plan.popular
                    ? 'border-[#00fff0]/50 bg-gradient-to-br from-[#00fff0]/5 to-[#a855f7]/5'
                    : 'border-white/10 bg-[#0a0a0a]'
                } hover:border-[#00fff0]/30 transition-all duration-300`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-[#00fff0] to-[#a855f7] rounded-full text-xs font-semibold text-black">
                    MOST POPULAR
                  </div>
                )}
                <div className="text-center mb-8">
                  <h3
                    className="text-2xl font-bold text-white mb-2"
                    style={{ fontFamily: 'Syne, sans-serif' }}
                  >
                    {plan.name}
                  </h3>
                  <p className="text-sm text-zinc-500 mb-6">{plan.description}</p>
                  <div className="flex items-baseline justify-center gap-2">
                    {plan.price !== 'Custom' && (
                      <span className="text-2xl text-zinc-500">$</span>
                    )}
                    <span
                      className="text-5xl font-bold text-white"
                      style={{ fontFamily: 'Syne, sans-serif' }}
                    >
                      {plan.price}
                    </span>
                    {plan.price !== 'Custom' && (
                      <span className="text-zinc-500">/month</span>
                    )}
                  </div>
                </div>
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-[#00fff0] flex-shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-zinc-400 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`block w-full py-3 rounded-full text-center font-semibold transition-all duration-300 ${
                    plan.popular
                      ? 'btn-primary'
                      : 'btn-glow'
                  }`}
                >
                  <span>Get Started</span>
                </Link>
              </div>
            ))}
          </div>

          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12" style={{ fontFamily: 'Syne, sans-serif' }}>
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              {[
                {
                  q: 'Can I switch plans anytime?',
                  a: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.'
                },
                {
                  q: 'What happens if I exceed my message limit?',
                  a: 'We will notify you when you reach 80% of your limit. You can upgrade or purchase additional messages.'
                },
                {
                  q: 'Is there a free trial?',
                  a: 'Yes, all plans include a 14-day free trial with no credit card required.'
                },
                {
                  q: 'What payment methods do you accept?',
                  a: 'We accept all major credit cards, PayPal, and wire transfers for Enterprise plans.'
                }
              ].map((faq, index) => (
                <div key={index} className="p-6 rounded-xl bg-[#0a0a0a] border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-2">{faq.q}</h3>
                  <p className="text-zinc-400">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
