import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="relative border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <div className="logo-glow">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 40 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="20" cy="20" r="18" stroke="url(#logoGradient)" strokeWidth="1.5" fill="none" />
                  <circle cx="20" cy="12" r="3" fill="#00fff0" />
                  <circle cx="12" cy="24" r="3" fill="#00fff0" />
                  <circle cx="28" cy="24" r="3" fill="#00fff0" />
                  <circle cx="20" cy="28" r="2" fill="#a855f7" />
                  <line x1="20" y1="15" x2="14" y2="22" stroke="#00fff0" strokeWidth="1.5" opacity="0.6" />
                  <line x1="20" y1="15" x2="26" y2="22" stroke="#00fff0" strokeWidth="1.5" opacity="0.6" />
                  <line x1="14" y1="25" x2="20" y2="28" stroke="#a855f7" strokeWidth="1.5" opacity="0.6" />
                  <line x1="26" y1="25" x2="20" y2="28" stroke="#a855f7" strokeWidth="1.5" opacity="0.6" />
                  <defs>
                    <linearGradient id="logoGradient" x1="0" y1="0" x2="40" y2="40">
                      <stop offset="0%" stopColor="#00fff0" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <span 
                className="text-xl font-bold tracking-tight"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                <span className="text-white">Djaber</span>
                <span className="text-[#00fff0]">.ai</span>
              </span>
            </Link>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              AI-powered social media agent that handles customer conversations 24/7.
            </p>
            {/* Social links */}
            <div className="flex gap-3">
              {[
                { name: 'Twitter', icon: 'M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z' },
                { name: 'GitHub', icon: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22' },
                { name: 'LinkedIn', icon: 'M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z' },
              ].map((social) => (
                <a
                  key={social.name}
                  href="#"
                  className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 hover:border-[#00fff0]/50 flex items-center justify-center transition-all duration-300 hover:bg-white/10"
                  aria-label={social.name}
                >
                  <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={social.icon} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Product</h3>
            <ul className="space-y-3">
              {['Features', 'Pricing', 'Integrations', 'API', 'Changelog'].map((item) => (
                <li key={item}>
                  <Link href="#" className="text-sm text-zinc-400 hover:text-white transition-colors">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Company</h3>
            <ul className="space-y-3">
              {['About', 'Blog', 'Careers', 'Press', 'Contact'].map((item) => (
                <li key={item}>
                  <Link href="#" className="text-sm text-zinc-400 hover:text-white transition-colors">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Resources</h3>
            <ul className="space-y-3">
              {['Documentation', 'Help Center', 'Community', 'Status', 'Terms'].map((item) => (
                <li key={item}>
                  <Link href="#" className="text-sm text-zinc-400 hover:text-white transition-colors">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-zinc-500">
            © 2025 Djaber.ai. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="#" className="text-sm text-zinc-500 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="#" className="text-sm text-zinc-500 hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link href="#" className="text-sm text-zinc-500 hover:text-white transition-colors">
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
