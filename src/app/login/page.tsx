'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const statsData = [
  [
    { value: '5,000+', label: 'Active Users', gradient: 'from-white to-zinc-400' },
    { value: '99.9%', label: 'Uptime', gradient: 'from-zinc-300 to-zinc-600' },
    { value: '<1s', label: 'Response Time', gradient: 'from-white/90 to-zinc-500' }
  ],
  [
    { value: '2M+', label: 'Messages Handled', gradient: 'from-white to-zinc-500' },
    { value: '24/7', label: 'AI Availability', gradient: 'from-zinc-200 to-zinc-700' },
    { value: '95%', label: 'Customer Satisfaction', gradient: 'from-white/95 to-zinc-400' }
  ],
  [
    { value: '50+', label: 'Countries', gradient: 'from-white to-zinc-600' },
    { value: '15+', label: 'Languages Supported', gradient: 'from-zinc-100 to-zinc-500' },
    { value: '100%', label: 'Fully Automated', gradient: 'from-white/90 to-zinc-600' }
  ]
];

const features = [
  {
    title: 'Instant AI Responses',
    desc: 'Your customers get immediate answers, day or night',
    highlight: 'Real-time engagement'
  },
  {
    title: 'Real-Time Analytics',
    desc: 'Track conversations, sentiment, and performance metrics',
    highlight: 'Data-driven insights'
  },
  {
    title: 'Multi-Platform Support',
    desc: 'Manage Facebook, Instagram, and more from one dashboard',
    highlight: 'Unified workspace'
  }
];

const testimonials = [
  {
    initials: 'JD',
    text: 'Djaber.ai transformed our customer service. We now handle 10x more conversations with the same team size.',
    name: 'John Doe',
    title: 'CEO, Fashion Store',
    metric: '10x more conversations'
  },
  {
    initials: 'SM',
    text: 'Response times went from hours to seconds. Our customers love the instant support experience.',
    name: 'Sarah Miller',
    title: 'Head of Support, Tech Co',
    metric: 'From hours to seconds'
  },
  {
    initials: 'RK',
    text: 'The AI understands context perfectly. It feels like chatting with a real human support agent.',
    name: 'Robert Kumar',
    title: 'Owner, Coffee Shop Chain',
    metric: '95% satisfaction rate'
  }
];

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [currentStatsIndex, setCurrentStatsIndex] = useState(0);
  const [currentTestimonialIndex, setCurrentTestimonialIndex] = useState(0);
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
  const [statsAnimClass, setStatsAnimClass] = useState('animate-scale-in');
  const [testimonialAnimClass, setTestimonialAnimClass] = useState('animate-fade-in');

  useEffect(() => {
    const statsInterval = setInterval(() => {
      setStatsAnimClass('opacity-0 scale-95');
      setTimeout(() => {
        setCurrentStatsIndex((prev) => (prev + 1) % statsData.length);
        setStatsAnimClass('animate-scale-in');
      }, 400);
    }, 6000);

    return () => clearInterval(statsInterval);
  }, []);

  useEffect(() => {
    const testimonialInterval = setInterval(() => {
      setTestimonialAnimClass('opacity-0 -translate-x-4');
      setTimeout(() => {
        setCurrentTestimonialIndex((prev) => (prev + 1) % testimonials.length);
        setTestimonialAnimClass('animate-slide-left');
      }, 400);
    }, 8000);

    return () => clearInterval(testimonialInterval);
  }, []);

  useEffect(() => {
    const featureInterval = setInterval(() => {
      setCurrentFeatureIndex((prev) => (prev + 1) % features.length);
    }, 4000);

    return () => clearInterval(featureInterval);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login submitted:', formData);
  };

  return (
    <div className="fixed inset-0 flex">
      {/* Back Button */}
      <Link
        href="/"
        className="fixed top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 rounded-full text-zinc-400 hover:text-white transition-all duration-300"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span className="text-sm">Back</span>
      </Link>
        {/* Left Side - Promotional Content */}
        <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#0a0a0a] to-[#000] p-12 flex-col justify-center overflow-hidden">
          {/* Vertical Divider */}
          <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#00fff0]/30 to-transparent"></div>
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-[#00fff0] rounded-full blur-3xl animate-float" style={{ animationDelay: '0s', animationDuration: '6s' }}></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#a855f7] rounded-full blur-3xl animate-float" style={{ animationDelay: '1s', animationDuration: '8s' }}></div>
        </div>

        <div className="relative z-10 max-w-xl mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="logo-glow">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="18" stroke="url(#sideLogoGradient)" strokeWidth="1.5" fill="none" />
                <circle cx="20" cy="12" r="3" fill="#00fff0" />
                <circle cx="12" cy="24" r="3" fill="#00fff0" />
                <circle cx="28" cy="24" r="3" fill="#00fff0" />
                <defs>
                  <linearGradient id="sideLogoGradient" x1="0" y1="0" x2="40" y2="40">
                    <stop offset="0%" stopColor="#00fff0" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
              <span className="text-white">Djaber</span>
              <span className="text-[#00fff0]">.ai</span>
            </span>
          </div>

          {/* Main Content */}
          <div className="mb-10 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <h2 className="text-4xl font-bold text-white mb-6 leading-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
              Welcome back to the future of customer service
            </h2>
            <p className="text-xl text-zinc-400 leading-relaxed">
              Your AI agents are ready to handle conversations 24/7
            </p>
          </div>

          {/* Rotating Feature Highlight */}
          <div className="mb-10 relative overflow-hidden min-h-[140px]">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className={`transition-all duration-500 ${
                  idx === currentFeatureIndex
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 absolute top-0 left-0 translate-x-8'
                }`}
              >
                <div className="relative bg-[#0a0a0a] backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-white/30 transition-all duration-300 group overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-3xl group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative z-10">
                    <div className="inline-block px-3 py-1 bg-white/10 border border-white/30 rounded-full mb-4">
                      <span className="text-xs text-white font-semibold uppercase tracking-wider">{feature.highlight}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                      {feature.title}
                    </h3>
                    <p className="text-zinc-400 text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className={`grid grid-cols-3 gap-4 mb-10 transition-all duration-500 ${statsAnimClass}`}>
            {statsData[currentStatsIndex].map((stat, i) => (
              <div
                key={i}
                className="relative bg-[#0a0a0a] backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:bg-[#141414] transition-all duration-300 hover:scale-105 group overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                <div className="relative z-10">
                  <div className={`text-2xl font-bold bg-gradient-to-br ${stat.gradient} bg-clip-text text-transparent mb-1`} style={{ fontFamily: 'Syne, sans-serif' }}>
                    {stat.value}
                  </div>
                  <div className="text-xs text-zinc-500">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div className={`bg-[#0a0a0a] backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-[#141414] transition-all duration-500 ${testimonialAnimClass}`}>
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-white to-zinc-600 flex items-center justify-center flex-shrink-0 text-black font-bold text-lg relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white to-zinc-600 animate-pulse opacity-50"></div>
                <span className="relative z-10">{testimonials[currentTestimonialIndex].initials}</span>
              </div>
              <div className="flex-1">
                <p className="text-white mb-3 italic leading-relaxed">
                  &quot;{testimonials[currentTestimonialIndex].text}&quot;
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white text-sm">{testimonials[currentTestimonialIndex].name}</div>
                    <div className="text-xs text-zinc-500">{testimonials[currentTestimonialIndex].title}</div>
                  </div>
                  <div className="px-3 py-1 bg-white/10 border border-white/30 rounded-full">
                    <span className="text-xs text-white font-semibold">{testimonials[currentTestimonialIndex].metric}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-black overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Logo - Mobile Only */}
          <div className="text-center mb-8 lg:hidden">
            <div className="inline-flex items-center gap-3 mb-6">
            <div className="logo-glow">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="18" stroke="url(#loginLogoGradient)" strokeWidth="1.5" fill="none" />
                <circle cx="20" cy="12" r="3" fill="#00fff0" />
                <circle cx="12" cy="24" r="3" fill="#00fff0" />
                <circle cx="28" cy="24" r="3" fill="#00fff0" />
                <circle cx="20" cy="28" r="2" fill="#a855f7" />
                <line x1="20" y1="15" x2="14" y2="22" stroke="#00fff0" strokeWidth="1.5" opacity="0.6" />
                <line x1="20" y1="15" x2="26" y2="22" stroke="#00fff0" strokeWidth="1.5" opacity="0.6" />
                <line x1="14" y1="25" x2="20" y2="28" stroke="#a855f7" strokeWidth="1.5" opacity="0.6" />
                <line x1="26" y1="25" x2="20" y2="28" stroke="#a855f7" strokeWidth="1.5" opacity="0.6" />
                <defs>
                  <linearGradient id="loginLogoGradient" x1="0" y1="0" x2="40" y2="40">
                    <stop offset="0%" stopColor="#00fff0" />
                    <stop offset="100%" stopColor="#a855f7" />
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
              Welcome Back
            </h1>
            <p className="text-zinc-400">Sign in to your account to continue</p>
          </div>

          {/* Form Card */}
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 mb-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:border-[#00fff0] focus:outline-none transition-colors"
                  placeholder="john@company.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-zinc-300">
                    Password
                  </label>
                  <Link href="/forgot-password" className="text-sm text-[#00fff0] hover:underline">
                    Forgot?
                  </Link>
                </div>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:border-[#00fff0] focus:outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>

              <div className="flex items-center group cursor-pointer">
                <input
                  type="checkbox"
                  id="remember"
                  className="w-5 h-5 rounded border-2 border-white/20 bg-black/50 text-white focus:ring-2 focus:ring-white/30 focus:ring-offset-0 focus:border-white/50 transition-all duration-200 cursor-pointer checked:bg-gradient-to-br checked:from-white checked:to-zinc-600 checked:border-white"
                />
                <label htmlFor="remember" className="ml-3 text-sm text-zinc-400 group-hover:text-white transition-colors cursor-pointer select-none">
                  Remember me for 30 days
                </label>
              </div>

              <button
                type="submit"
                className="w-full btn-primary px-6 py-4 rounded-full font-semibold"
              >
                <span>Sign In</span>
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[#0a0a0a] text-zinc-500">Or continue with</span>
              </div>
            </div>

            {/* Social Login */}
            <div className="grid grid-cols-2 gap-4">
              <button className="flex items-center justify-center gap-3 px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white hover:border-white/20 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Google</span>
              </button>
              <button className="flex items-center justify-center gap-3 px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white hover:border-white/20 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" fill="#1877F2"/>
                </svg>
                <span>Facebook</span>
              </button>
            </div>
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-sm text-zinc-400">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-[#00fff0] hover:underline font-medium">
              Get started for free
            </Link>
          </p>

          {/* Footer Links */}
          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-zinc-500">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <span>•</span>
            <Link href="/help" className="hover:text-white transition-colors">
              Help
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
