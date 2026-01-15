import Link from 'next/link';

export default function FeaturesPage() {
  return (
    <main className="min-h-screen pt-20">
      <section className="relative py-32 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h1
              className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              <span className="gradient-text">Powerful Features</span>
            </h1>
            <p className="text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
              Everything you need to automate customer conversations and scale your social presence
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: 'Instant Responses',
                description: 'AI responds in under 1 second, keeping customers engaged',
                features: ['Sub-second response', 'No missed messages', '24/7 available']
              },
              {
                title: 'Smart Context',
                description: 'Remembers conversation history and understands intent',
                features: ['Full history', 'Intent recognition', 'Contextual replies']
              },
              {
                title: 'Multi-Platform',
                description: 'Facebook, Instagram, and Messenger in one dashboard',
                features: ['Facebook Pages', 'Instagram Business', 'Messenger']
              },
              {
                title: 'Custom Training',
                description: 'Train AI with your brand voice and knowledge',
                features: ['Brand voice', 'FAQ library', 'Product catalog']
              },
              {
                title: 'Analytics',
                description: 'Track metrics, satisfaction, and ROI in real-time',
                features: ['Real-time data', 'Sentiment analysis', 'Performance']
              },
              {
                title: 'Human Handoff',
                description: 'Seamlessly transfer to your team when needed',
                features: ['Smart escalation', 'Team alerts', 'Smooth transitions']
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="group relative p-8 rounded-2xl bg-[#0a0a0a] border border-white/10 hover:border-white/30 transition-all duration-300"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#00fff0]/5 to-[#a855f7]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <h3
                    className="text-2xl font-bold text-white mb-4"
                    style={{ fontFamily: 'Syne, sans-serif' }}
                  >
                    {feature.title}
                  </h3>
                  <p className="text-zinc-400 leading-relaxed mb-6">
                    {feature.description}
                  </p>
                  <ul className="space-y-2">
                    {feature.features.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-zinc-500">
                        <svg className="w-4 h-4 text-[#00fff0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-32 px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative p-12 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent">
            <h2 className="text-4xl font-bold mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
              Ready to Get Started?
            </h2>
            <p className="text-lg text-zinc-400 mb-10">
              Start your free trial and transform your customer service
            </p>
            <Link
              href="/signup"
              className="btn-primary px-8 py-4 rounded-full text-base font-semibold inline-flex items-center justify-center gap-2"
            >
              <span>Start Free Trial</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
