import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-screen pt-20 overflow-x-hidden">
      <section className="relative py-16 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 sm:mb-20">
            <h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              <span className="gradient-text">Terms of Service</span>
            </h1>
            <p className="text-base sm:text-xl text-zinc-400 max-w-2xl mx-auto px-4">
              Last updated: January 15, 2026
            </p>
          </div>

          <div className="prose prose-invert max-w-none space-y-8">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                Agreement to Terms
              </h2>
              <p className="text-zinc-400 leading-relaxed">
                By accessing and using Djaber.ai, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using this platform.
              </p>
            </div>

            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                Use License
              </h2>
              <div className="space-y-4 text-zinc-400">
                <p>Permission is granted to use Djaber.ai for commercial purposes under the following conditions:</p>
                <ul className="space-y-2 ml-4">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                    <span>You must maintain an active subscription to access platform features</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                    <span>You may not attempt to reverse engineer or modify our AI models</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                    <span>You may not use the platform for illegal or unauthorized purposes</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                    <span>You are responsible for maintaining the security of your account</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                Account Responsibilities
              </h2>
              <div className="space-y-4 text-zinc-400">
                <p>When you create an account with us, you must provide accurate and complete information. You are responsible for:</p>
                <ul className="space-y-2 ml-4">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                    <span>Maintaining the confidentiality of your account password</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                    <span>All activities that occur under your account</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                    <span>Notifying us immediately of any unauthorized access</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                    <span>Compliance with all applicable Facebook and Instagram policies</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                Service Availability
              </h2>
              <div className="space-y-4 text-zinc-400">
                <p>We strive to maintain 99.9% uptime, but we do not guarantee uninterrupted service. The platform may be unavailable due to:</p>
                <ul className="space-y-2 ml-4">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                    <span>Scheduled maintenance and updates</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                    <span>Emergency repairs or security patches</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                    <span>Third-party service disruptions (Facebook, Instagram APIs)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                    <span>Force majeure events beyond our control</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                Subscription and Payments
              </h2>
              <div className="space-y-4 text-zinc-400">
                <p><strong className="text-white">Billing:</strong> Subscriptions are billed monthly or annually based on your selected plan. All fees are non-refundable except as required by law.</p>
                <p><strong className="text-white">Free Trial:</strong> We offer a 14-day free trial for new users. Your payment method will be charged automatically after the trial period unless you cancel.</p>
                <p><strong className="text-white">Cancellation:</strong> You may cancel your subscription at any time. Your access will continue until the end of the current billing period.</p>
                <p><strong className="text-white">Price Changes:</strong> We reserve the right to change pricing with 30 days notice. Changes will not affect your current billing cycle.</p>
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                AI Usage and Content
              </h2>
              <div className="space-y-4 text-zinc-400">
                <p>Our AI models are designed to assist with customer service conversations. However:</p>
                <ul className="space-y-2 ml-4">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                    <span>You are responsible for reviewing and approving AI-generated responses</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                    <span>You retain ownership of your conversation data and content</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                    <span>We may use anonymized data to improve our AI models</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                    <span>You must ensure AI responses comply with your brand guidelines</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                Prohibited Activities
              </h2>
              <div className="space-y-4 text-zinc-400">
                <p>You agree not to:</p>
                <ul className="space-y-2 ml-4">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                    <span>Use the platform for spam, harassment, or illegal activities</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                    <span>Attempt to hack, disrupt, or compromise platform security</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                    <span>Share your account credentials with unauthorized users</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                    <span>Use the platform to violate any third-party rights</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                    <span>Scrape, copy, or redistribute platform content without permission</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                Limitation of Liability
              </h2>
              <p className="text-zinc-400 leading-relaxed">
                Djaber.ai and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the platform. Our total liability is limited to the amount you paid in the last 12 months.
              </p>
            </div>

            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                Termination
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                We may terminate or suspend your account immediately, without prior notice, for any breach of these Terms. Upon termination:
              </p>
              <ul className="space-y-2 ml-4 text-zinc-400">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span>Your right to use the platform will cease immediately</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span>You may export your data within 30 days</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span>All provisions that should survive termination will remain in effect</span>
                </li>
              </ul>
            </div>

            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                Changes to Terms
              </h2>
              <p className="text-zinc-400 leading-relaxed">
                We reserve the right to modify these terms at any time. We will notify you of significant changes via email or through the platform. Continued use of Djaber.ai after changes constitutes acceptance of the new terms.
              </p>
            </div>

            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                Contact Information
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                For questions about these Terms of Service, please contact:
              </p>
              <div className="bg-black/50 border border-white/10 rounded-lg p-4 text-sm text-zinc-400">
                <p>Email: legal@djaber.ai</p>
                <p>Address: 123 AI Street, Tech City, TC 12345</p>
              </div>
            </div>

            <div className="pt-8 border-t border-white/5 text-center">
              <p className="text-zinc-400 text-sm">
                <Link href="/" className="text-white hover:underline">Back to Home</Link>
                {' • '}
                <Link href="/privacy" className="text-white hover:underline">Privacy Policy</Link>
                {' • '}
                <Link href="/help" className="text-white hover:underline">Help Center</Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
