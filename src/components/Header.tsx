'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Blur backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl border-b border-white/5" />
      
      <nav className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              {/* Logo icon with glow effect */}
              <div className="logo-glow">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 40 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="transition-transform duration-300 group-hover:scale-110"
                >
                  {/* Neural network style logo */}
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
            </div>
            <span 
              className="text-xl font-bold tracking-tight"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              <span className="text-white">Djaber</span>
              <span className="text-[#00fff0]">.ai</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { name: 'Features', href: '/features' },
              { name: 'Pricing', href: '/pricing' },
              { name: 'Docs', href: '/docs' },
            ].map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-200 relative group"
              >
                {item.name}
                <span className="absolute bottom-1 left-4 right-4 h-px bg-gradient-to-r from-[#00fff0] to-[#a855f7] scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
              </Link>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors duration-200"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="btn-primary px-5 py-2.5 rounded-full text-sm font-semibold"
            >
              <span>Get Started</span>
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-zinc-400 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              {isMobileMenuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="4" y1="8" x2="20" y2="8" />
                  <line x1="4" y1="16" x2="20" y2="16" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-white/5">
            <div className="flex flex-col gap-2">
              {[
                { name: 'Features', href: '/features' },
                { name: 'Pricing', href: '/pricing' },
                { name: 'Docs', href: '/docs' },
              ].map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="px-4 py-3 text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-200"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-white/5">
                <Link
                  href="/login"
                  className="px-4 py-3 text-sm font-medium text-zinc-300 hover:text-white text-center rounded-lg border border-white/10 hover:border-white/20 transition-all duration-200"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="btn-primary px-4 py-3 rounded-full text-sm font-semibold text-center"
                >
                  <span>Get Started</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
