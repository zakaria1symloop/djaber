import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen pt-20 overflow-x-hidden">
      <section className="relative py-16 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 sm:mb-20">
            <h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              <span className="gradient-text">Privacy Policy</span>
            </h1>
            <p className="text-base sm:text-xl text-zinc-400 max-w-2xl mx-auto px-4">
              Last updated: January 15, 2026
            </p>
          </div>

          <div className="prose prose-invert max-w-none space-y-8">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                Introduction
              </h2>
              <p className="text-zinc-400 leading-relaxed">
                At Djaber.ai, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered social media management platform.
              </p>
            </div>

            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                Information We Collect
              </h2>
              <div className="space-y-4 text-zinc-400">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Personal Information</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Name and email address</li>
                    <li>Company information</li>
                    <li>Phone number (optional)</li>
                    <li>Payment information (processed securely through our payment providers)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Social Media Data</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Facebook and Instagram page access tokens</li>
                    <li>Page messages and conversations</li>
                    <li>Page analytics and insights</li>
                    <li>Customer interaction data</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Usage Information</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Log data and device information</li>
                    <li>Browser type and IP address</li>
                    <li>Pages visited and features used</li>
                    <li>Time spent on the platform</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                How We Use Your Information
              </h2>
              <ul className="space-y-3 text-zinc-400">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span>Provide and maintain our AI-powered customer service platform</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span>Process and respond to customer messages on your behalf</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span>Train and improve our AI models</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span>Generate analytics and insights about your conversations</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span>Send you updates, newsletters, and marketing communications</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span>Detect, prevent, and address technical issues or security threats</span>
                </li>
              </ul>
            </div>

            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                Data Security
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                We implement industry-standard security measures to protect your information:
              </p>
              <ul className="space-y-3 text-zinc-400">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span>SSL/TLS encryption for data in transit</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span>AES-256 encryption for data at rest</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span>Regular security audits and penetration testing</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span>Secure authentication and access controls</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span>Compliance with GDPR and other data protection regulations</span>
                </li>
              </ul>
            </div>

            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                Data Sharing
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                We do not sell your personal information. We may share your data with:
              </p>
              <ul className="space-y-3 text-zinc-400">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span><strong className="text-white">Service Providers:</strong> Third-party companies that help us operate our platform</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span><strong className="text-white">Legal Requirements:</strong> When required by law or to protect our rights</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span><strong className="text-white">Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</span>
                </li>
              </ul>
            </div>

            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                Your Rights
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                You have the following rights regarding your personal data:
              </p>
              <ul className="space-y-3 text-zinc-400">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span><strong className="text-white">Access:</strong> Request a copy of your personal data</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span><strong className="text-white">Correction:</strong> Update or correct inaccurate information</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span><strong className="text-white">Deletion:</strong> Request deletion of your personal data</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span><strong className="text-white">Portability:</strong> Receive your data in a portable format</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-2"></span>
                  <span><strong className="text-white">Opt-out:</strong> Unsubscribe from marketing communications</span>
                </li>
              </ul>
            </div>

            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                Cookies and Tracking
              </h2>
              <p className="text-zinc-400 leading-relaxed">
                We use cookies and similar tracking technologies to improve your experience, analyze usage, and deliver personalized content. You can control cookies through your browser settings.
              </p>
            </div>

            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                Contact Us
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                If you have questions about this Privacy Policy, please contact us:
              </p>
              <div className="bg-black/50 border border-white/10 rounded-lg p-4 text-sm text-zinc-400">
                <p>Email: privacy@djaber.ai</p>
                <p>Address: 123 AI Street, Tech City, TC 12345</p>
              </div>
            </div>

            <div className="pt-8 border-t border-white/5 text-center">
              <p className="text-zinc-400 text-sm">
                <Link href="/" className="text-white hover:underline">Back to Home</Link>
                {' • '}
                <Link href="/terms" className="text-white hover:underline">Terms of Service</Link>
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
