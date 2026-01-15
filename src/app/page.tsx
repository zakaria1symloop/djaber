import Link from 'next/link';
import AnimatedDashboard from '@/components/AnimatedDashboard';

export default function Home() {
  return (
    <main className="min-h-screen">
      <section className="relative pt-32 pb-20 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-4xl mx-auto text-center">
            <div className="animate-fade-in inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00fff0] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00fff0]"></span>
              </span>
              <span className="text-sm text-zinc-400">Now supporting Facebook and Instagram</span>
            </div>

            <h1
              className="animate-fade-in-delay-1 text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-8"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              <span className="text-white">Your AI Agent for</span>
              <br />
              <span className="gradient-text">Social Media</span>
            </h1>

            <p className="animate-fade-in-delay-2 text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              Connect your Facebook and Instagram pages. Let our AI handle customer
              conversations 24/7. Never miss a message again.
            </p>

            <div className="animate-fade-in-delay-3 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="btn-primary px-8 py-4 rounded-full text-base font-semibold inline-flex items-center justify-center gap-2 group"
              >
                <span>Start Free Trial</span>
                <svg
                  className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                href="#demo"
                className="btn-glow px-8 py-4 rounded-full text-base font-medium text-white inline-flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 text-[#00fff0]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                Watch Demo
              </Link>
            </div>
          </div>

          <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {[
              { value: '10K+', label: 'Messages Handled' },
              { value: '500+', label: 'Active Pages' },
              { value: '99.9%', label: 'Uptime' },
              { value: '<1s', label: 'Response Time' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="text-center p-6 rounded-2xl bg-[#0a0a0a] border border-white/10 hover:border-white/20 transition-colors duration-300"
              >
                <div
                  className="text-3xl sm:text-4xl font-bold text-white mb-2"
                  style={{ fontFamily: 'Syne, sans-serif' }}
                >
                  {stat.value}
                </div>
                <div className="text-sm text-zinc-500">{stat.label}</div>
              </div>
            ))}
          </div>

          <AnimatedDashboard />
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-32 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2
              className="text-4xl sm:text-5xl font-bold mb-6"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              <span className="gradient-text">Powerful Features</span>
            </h2>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              Everything you need to automate customer conversations and scale your social presence
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: 'Instant Responses',
                description: 'AI responds to messages in under 1 second, keeping customers engaged'
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                title: 'Smart Context',
                description: 'AI remembers conversation history and understands customer intent'
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                  </svg>
                ),
                title: 'Multi-Platform',
                description: 'Manage Facebook, Instagram, and Messenger from one dashboard'
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                ),
                title: 'Custom Training',
                description: 'Train AI with your brand voice, FAQs, and product knowledge'
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
                title: 'Analytics Dashboard',
                description: 'Track response times, customer satisfaction, and conversation metrics'
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ),
                title: 'Human Handoff',
                description: 'Seamlessly transfer complex queries to your team when needed'
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="group relative p-8 rounded-2xl bg-[#0a0a0a] border border-white/10 hover:border-white/30 transition-all duration-300 hover:bg-[#141414]"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#00fff0]/5 to-[#a855f7]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00fff0]/20 to-[#a855f7]/20 flex items-center justify-center mb-6 text-[#00fff0] group-hover:scale-110 transition-transform duration-300">
                    {feature.icon}
                  </div>
                  <h3
                    className="text-xl font-bold text-white mb-3"
                    style={{ fontFamily: 'Syne, sans-serif' }}
                  >
                    {feature.title}
                  </h3>
                  <p className="text-zinc-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative py-32 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2
              className="text-4xl sm:text-5xl font-bold mb-6"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Get Started in <span className="gradient-text">3 Steps</span>
            </h2>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              Connect your pages and let AI handle the rest
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-12">
            {[
              {
                step: '01',
                title: 'Connect Your Pages',
                description: 'Link your Facebook and Instagram business pages with one click using OAuth',
                color: 'from-[#00fff0] to-[#3b82f6]'
              },
              {
                step: '02',
                title: 'Train Your AI',
                description: 'Upload your FAQs, product info, and brand guidelines to customize responses',
                color: 'from-[#3b82f6] to-[#a855f7]'
              },
              {
                step: '03',
                title: 'Go Live',
                description: 'Activate the AI agent and watch it handle customer conversations automatically',
                color: 'from-[#a855f7] to-[#00fff0]'
              },
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="text-center">
                  <div
                    className={`inline-block text-8xl font-bold mb-6 bg-gradient-to-br ${item.color} bg-clip-text text-transparent opacity-20`}
                    style={{ fontFamily: 'Syne, sans-serif' }}
                  >
                    {item.step}
                  </div>
                  <h3
                    className="text-2xl font-bold text-white mb-4"
                    style={{ fontFamily: 'Syne, sans-serif' }}
                  >
                    {item.title}
                  </h3>
                  <p className="text-zinc-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
                {index < 2 && (
                  <div className="hidden lg:block absolute top-20 -right-6 w-12 h-px bg-gradient-to-r from-[#00fff0]/50 to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="relative py-32 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2
              className="text-4xl sm:text-5xl font-bold mb-6"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Simple <span className="gradient-text">Pricing</span>
            </h2>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              Choose the plan that fits your business
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
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
                  'Analytics dashboard'
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
                  'Team collaboration'
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
                  'Training & onboarding'
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
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-32 px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative p-12 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#00fff0]/10 to-[#a855f7]/10" />
            <div className="relative">
              <h2
                className="text-4xl sm:text-5xl font-bold mb-6"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                Ready to <span className="gradient-text">Transform</span> Your Customer Service?
              </h2>
              <p className="text-lg text-zinc-400 mb-10 max-w-2xl mx-auto">
                Join hundreds of businesses using AI to respond faster and scale their social presence
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/signup"
                  className="btn-primary px-8 py-4 rounded-full text-base font-semibold inline-flex items-center justify-center gap-2 group"
                >
                  <span>Start Free Trial</span>
                  <svg
                    className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
                <Link
                  href="#contact"
                  className="btn-glow px-8 py-4 rounded-full text-base font-medium text-white inline-flex items-center justify-center"
                >
                  Talk to Sales
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/5 py-16 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="logo-glow">
                  <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="18" stroke="url(#footerLogoGradient)" strokeWidth="1.5" fill="none" />
                    <circle cx="20" cy="12" r="3" fill="#00fff0" />
                    <circle cx="12" cy="24" r="3" fill="#00fff0" />
                    <circle cx="28" cy="24" r="3" fill="#00fff0" />
                    <defs>
                      <linearGradient id="footerLogoGradient" x1="0" y1="0" x2="40" y2="40">
                        <stop offset="0%" stopColor="#00fff0" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <span className="text-xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                  <span className="text-white">Djaber</span>
                  <span className="text-[#00fff0]">.ai</span>
                </span>
              </div>
              <p className="text-sm text-zinc-500">
                AI-powered social media automation for modern businesses
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-3">
                {['Features', 'Pricing', 'Integration', 'API'].map((item) => (
                  <li key={item}>
                    <Link href="#" className="text-sm text-zinc-500 hover:text-white transition-colors">
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-3">
                {['About', 'Blog', 'Careers', 'Contact'].map((item) => (
                  <li key={item}>
                    <Link href="#" className="text-sm text-zinc-500 hover:text-white transition-colors">
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-3">
                {['Privacy', 'Terms', 'Security', 'Cookies'].map((item) => (
                  <li key={item}>
                    <Link href="#" className="text-sm text-zinc-500 hover:text-white transition-colors">
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-zinc-500">
              © 2026 Djaber.ai. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              {['Twitter', 'LinkedIn', 'GitHub'].map((social) => (
                <Link
                  key={social}
                  href="#"
                  className="text-zinc-500 hover:text-white transition-colors"
                  aria-label={social}
                >
                  <span className="text-sm">{social}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
