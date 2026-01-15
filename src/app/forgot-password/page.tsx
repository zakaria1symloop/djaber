'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle forgot password logic here
    setIsSubmitted(true);
  };

  return (
    <div className="fixed inset-0 flex bg-black">
      {/* Back Button */}
      <Link
        href="/login"
        className="fixed top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 rounded-full text-zinc-400 hover:text-white transition-all duration-300"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span className="text-sm">Back to Login</span>
      </Link>

      {/* Left Side - Information */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#0a0a0a] to-[#000] p-12 flex-col justify-center overflow-hidden">
        {/* Vertical Divider */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/30 to-transparent"></div>

        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl animate-float" style={{ animationDelay: '0s', animationDuration: '6s' }}></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-zinc-600 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s', animationDuration: '8s' }}></div>
        </div>

        <div className="relative z-10 max-w-xl mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="logo-glow">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="18" stroke="url(#forgotGradient)" strokeWidth="1.5" fill="none" />
                <circle cx="20" cy="12" r="3" fill="white" />
                <circle cx="12" cy="24" r="3" fill="white" />
                <circle cx="28" cy="24" r="3" fill="white" />
                <defs>
                  <linearGradient id="forgotGradient" x1="0" y1="0" x2="40" y2="40">
                    <stop offset="0%" stopColor="white" />
                    <stop offset="100%" stopColor="#71717a" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
              <span className="text-white">Djaber</span>
              <span className="text-zinc-400">.ai</span>
            </span>
          </div>

          {/* Main Content */}
          <div className="mb-10 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <h2 className="text-4xl font-bold text-white mb-6 leading-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
              Reset your password
            </h2>
            <p className="text-xl text-zinc-400 leading-relaxed">
              We'll send you instructions to reset your password
            </p>
          </div>

          {/* Security Features */}
          <div className="space-y-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex gap-4 items-start p-4 rounded-xl bg-[#0a0a0a] border border-white/10">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white to-zinc-600 flex items-center justify-center flex-shrink-0 relative">
                <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-white font-semibold mb-1">Secure Process</div>
                <div className="text-sm text-zinc-400">Your password reset link is encrypted and expires in 1 hour</div>
              </div>
            </div>

            <div className="flex gap-4 items-start p-4 rounded-xl bg-[#0a0a0a] border border-white/10">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white to-zinc-600 flex items-center justify-center flex-shrink-0 relative">
                <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-white font-semibold mb-1">Email Verification</div>
                <div className="text-sm text-zinc-400">Check your inbox for the password reset link</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-black overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Logo - Mobile Only */}
          <div className="text-center mb-8 lg:hidden">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="logo-glow">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="18" stroke="url(#forgotMobileGradient)" strokeWidth="1.5" fill="none" />
                  <circle cx="20" cy="12" r="3" fill="white" />
                  <circle cx="12" cy="24" r="3" fill="white" />
                  <circle cx="28" cy="24" r="3" fill="white" />
                  <circle cx="20" cy="28" r="2" fill="#71717a" />
                  <line x1="20" y1="15" x2="14" y2="22" stroke="white" strokeWidth="1.5" opacity="0.6" />
                  <line x1="20" y1="15" x2="26" y2="22" stroke="white" strokeWidth="1.5" opacity="0.6" />
                  <line x1="14" y1="25" x2="20" y2="28" stroke="#71717a" strokeWidth="1.5" opacity="0.6" />
                  <line x1="26" y1="25" x2="20" y2="28" stroke="#71717a" strokeWidth="1.5" opacity="0.6" />
                  <defs>
                    <linearGradient id="forgotMobileGradient" x1="0" y1="0" x2="40" y2="40">
                      <stop offset="0%" stopColor="white" />
                      <stop offset="100%" stopColor="#71717a" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1
              className="text-4xl font-bold text-white mb-3"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Forgot Password?
            </h1>
            <p className="text-zinc-400">Enter your email to receive a reset link</p>
          </div>

          {!isSubmitted ? (
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 mb-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none transition-colors"
                    placeholder="john@company.com"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full btn-primary px-6 py-4 rounded-full font-semibold"
                >
                  <span>Send Reset Link</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 mb-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-white to-zinc-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Check Your Email
                </h3>
                <p className="text-zinc-400 mb-6">
                  We've sent a password reset link to <span className="text-white font-medium">{email}</span>
                </p>
                <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-4 text-sm text-zinc-400">
                  <p className="mb-2">Didn't receive the email?</p>
                  <button
                    onClick={() => setIsSubmitted(false)}
                    className="text-white hover:underline font-medium"
                  >
                    Try another email address
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Back to Login */}
          <p className="text-center text-sm text-zinc-400">
            Remember your password?{' '}
            <Link href="/login" className="text-white hover:underline font-medium">
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
