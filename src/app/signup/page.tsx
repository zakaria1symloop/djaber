'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const quickSteps = [
  [
    { step: '1', title: 'Create your account', desc: 'Quick signup with just a few details', color: 'from-white to-zinc-400' },
    { step: '2', title: 'Connect your pages', desc: 'Link Facebook & Instagram in one click', color: 'from-zinc-300 to-zinc-600' },
    { step: '3', title: 'Let AI handle conversations', desc: 'Watch your AI agent respond 24/7', color: 'from-white/90 to-zinc-500' }
  ],
  [
    { step: '1', title: 'Train your AI', desc: 'Upload FAQs and product info instantly', color: 'from-white to-zinc-500' },
    { step: '2', title: 'Customize responses', desc: 'Match your brand voice perfectly', color: 'from-zinc-200 to-zinc-700' },
    { step: '3', title: 'Go live', desc: 'Start automating in minutes', color: 'from-white/95 to-zinc-400' }
  ],
  [
    { step: '1', title: 'Set up workspace', desc: 'Organize your team and permissions', color: 'from-white to-zinc-600' },
    { step: '2', title: 'Monitor conversations', desc: 'Real-time dashboard and analytics', color: 'from-zinc-100 to-zinc-500' },
    { step: '3', title: 'Scale effortlessly', desc: 'Handle unlimited conversations', color: 'from-white/90 to-zinc-600' }
  ]
];

const benefits = [
  [
    { text: '14-day free trial, no credit card required' },
    { text: 'AI trained on your business instantly' },
    { text: 'Connect unlimited social pages' },
    { text: 'Real-time conversation monitoring' },
    { text: 'Cancel anytime, no commitments' }
  ],
  [
    { text: 'Multi-language support included' },
    { text: 'Smart human handoff when needed' },
    { text: 'Advanced analytics & insights' },
    { text: 'Custom AI personality settings' },
    { text: 'Priority email & chat support' }
  ],
  [
    { text: 'Seamless integrations with CRM' },
    { text: 'Export conversation history anytime' },
    { text: 'Team collaboration features' },
    { text: 'Custom workflow automation' },
    { text: 'Dedicated account manager' }
  ]
];

const successMetrics = [
  { value: '80%', label: 'Reduced Response Time', color: 'from-white to-zinc-500' },
  { value: '10x', label: 'More Conversations Handled', color: 'from-zinc-200 to-zinc-700' },
  { value: '95%', label: 'Customer Satisfaction', color: 'from-white/90 to-zinc-600' }
];

export default function SignupPage() {
  const [selectedPlan, setSelectedPlan] = useState<'teams' | 'individual' | null>(null);

  if (selectedPlan) {
    return <SignupForm plan={selectedPlan} onBack={() => setSelectedPlan(null)} />;
  }

  return (
    <main className="min-h-screen pt-20">
      <section className="relative py-32 px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div>
            {/* Hero */}
            <div className="text-center mb-20">
              <h1
                className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                Get Started with <span className="gradient-text">Djaber.ai</span>
              </h1>
              <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
                Choose the plan that best fits your needs
              </p>
            </div>

              {/* Plan Selection Cards */}
              <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                {/* Teams Plan */}
                <div
                  onClick={() => setSelectedPlan('teams')}
                  className="group relative p-10 rounded-3xl bg-[#0a0a0a] border border-white/10 hover:border-[#00fff0]/50 transition-all duration-300 cursor-pointer"
                >
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#00fff0]/5 to-[#a855f7]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="relative">
                    {/* Icon */}
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00fff0]/20 to-[#a855f7]/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                      <svg className="w-8 h-8 text-[#00fff0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>

                    <h3
                      className="text-3xl font-bold text-white mb-4"
                      style={{ fontFamily: 'Syne, sans-serif' }}
                    >
                      For Teams
                    </h3>
                    <p className="text-zinc-400 text-lg mb-6 leading-relaxed">
                      Perfect for businesses and organizations managing multiple pages
                    </p>

                    <ul className="space-y-3 mb-8">
                      {[
                        'Multiple team members',
                        'Shared inbox & collaboration',
                        'Advanced permissions',
                        'Team analytics',
                        'Priority support'
                      ].map((feature, i) => (
                        <li key={i} className="flex items-center gap-3 text-zinc-300">
                          <svg className="w-5 h-5 text-[#00fff0] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-zinc-500">Starting at</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>$149</span>
                          <span className="text-zinc-500">/month</span>
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-[#00fff0]/20 flex items-center justify-center group-hover:bg-[#00fff0] transition-colors duration-300">
                        <svg className="w-6 h-6 text-[#00fff0] group-hover:text-black transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Individual Plan */}
                <div
                  onClick={() => setSelectedPlan('individual')}
                  className="group relative p-10 rounded-3xl bg-[#0a0a0a] border border-white/10 hover:border-[#a855f7]/50 transition-all duration-300 cursor-pointer"
                >
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#a855f7]/5 to-[#00fff0]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="relative">
                    {/* Icon */}
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#a855f7]/20 to-[#00fff0]/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                      <svg className="w-8 h-8 text-[#a855f7]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>

                    <h3
                      className="text-3xl font-bold text-white mb-4"
                      style={{ fontFamily: 'Syne, sans-serif' }}
                    >
                      Individual
                    </h3>
                    <p className="text-zinc-400 text-lg mb-6 leading-relaxed">
                      Ideal for solopreneurs and small businesses
                    </p>

                    <ul className="space-y-3 mb-8">
                      {[
                        'Single user account',
                        'AI-powered responses',
                        'Basic analytics',
                        'Email support',
                        '14-day free trial'
                      ].map((feature, i) => (
                        <li key={i} className="flex items-center gap-3 text-zinc-300">
                          <svg className="w-5 h-5 text-[#a855f7] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-zinc-500">Starting at</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>$49</span>
                          <span className="text-zinc-500">/month</span>
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-[#a855f7]/20 flex items-center justify-center group-hover:bg-[#a855f7] transition-colors duration-300">
                        <svg className="w-6 h-6 text-[#a855f7] group-hover:text-black transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            {/* Trust Indicators */}
            <div className="mt-20 text-center">
              <p className="text-sm text-zinc-500 mb-6">Trusted by businesses worldwide</p>
              <div className="flex justify-center items-center gap-12 flex-wrap opacity-40">
                <div className="text-2xl font-bold text-zinc-600">BRAND</div>
                <div className="text-2xl font-bold text-zinc-600">BRAND</div>
                <div className="text-2xl font-bold text-zinc-600">BRAND</div>
                <div className="text-2xl font-bold text-zinc-600">BRAND</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function SignupForm({ plan, onBack }: { plan: 'teams' | 'individual'; onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    company: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [currentStepsIndex, setCurrentStepsIndex] = useState(0);
  const [currentBenefitsIndex, setCurrentBenefitsIndex] = useState(0);
  const [currentMetricIndex, setCurrentMetricIndex] = useState(0);
  const [stepsAnimClass, setStepsAnimClass] = useState('animate-slide-left');
  const [benefitsAnimClass, setBenefitsAnimClass] = useState('animate-fade-in');

  useEffect(() => {
    const stepsInterval = setInterval(() => {
      setStepsAnimClass('opacity-0 translate-x-4');
      setTimeout(() => {
        setCurrentStepsIndex((prev) => (prev + 1) % quickSteps.length);
        setStepsAnimClass('animate-slide-left');
      }, 400);
    }, 7000);

    return () => clearInterval(stepsInterval);
  }, []);

  useEffect(() => {
    const benefitsInterval = setInterval(() => {
      setBenefitsAnimClass('opacity-0 scale-95');
      setTimeout(() => {
        setCurrentBenefitsIndex((prev) => (prev + 1) % benefits.length);
        setBenefitsAnimClass('animate-scale-in');
      }, 400);
    }, 9000);

    return () => clearInterval(benefitsInterval);
  }, []);

  useEffect(() => {
    const metricInterval = setInterval(() => {
      setCurrentMetricIndex((prev) => (prev + 1) % successMetrics.length);
    }, 5000);

    return () => clearInterval(metricInterval);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 2) {
      setStep(step + 1);
    } else {
      console.log('Form submitted:', formData);
    }
  };

  return (
    <div className="fixed inset-0 flex bg-black">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="fixed top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 rounded-full text-zinc-400 hover:text-white transition-all duration-300"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span className="text-sm">Back</span>
      </button>
        {/* Left Side - Getting Started Tips */}
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
                <circle cx="20" cy="20" r="18" stroke="url(#sideSignupGradient)" strokeWidth="1.5" fill="none" />
                <circle cx="20" cy="12" r="3" fill="#00fff0" />
                <circle cx="12" cy="24" r="3" fill="#00fff0" />
                <circle cx="28" cy="24" r="3" fill="#00fff0" />
                <defs>
                  <linearGradient id="sideSignupGradient" x1="0" y1="0" x2="40" y2="40">
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
          <div className="mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <h2 className="text-4xl font-bold text-white mb-6 leading-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
              {plan === 'teams' ? 'Build your team workspace in minutes' : 'Get started with AI-powered conversations'}
            </h2>
            <p className="text-xl text-zinc-400 leading-relaxed">
              Join thousands of businesses automating their customer service
            </p>
          </div>

          {/* Success Metric Highlight */}
          <div className="mb-8 relative overflow-hidden min-h-[120px]">
            {successMetrics.map((metric, idx) => (
              <div
                key={idx}
                className={`transition-all duration-500 ${
                  idx === currentMetricIndex
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 absolute top-0 left-0 -translate-y-4'
                }`}
              >
                <div className="relative bg-[#0a0a0a] backdrop-blur-sm rounded-2xl p-6 border border-white/10 overflow-hidden group hover:border-white/30 transition-all duration-300">
                  <div className={`absolute inset-0 bg-gradient-to-br ${metric.color} opacity-5 group-hover:opacity-10 transition-opacity duration-300`}></div>
                  <div className="relative z-10">
                    <div className={`text-5xl font-bold bg-gradient-to-br ${metric.color} bg-clip-text text-transparent mb-2`} style={{ fontFamily: 'Syne, sans-serif' }}>
                      {metric.value}
                    </div>
                    <div className="text-zinc-300 font-medium">{metric.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Start Steps */}
          <div className={`space-y-3 mb-8 transition-all duration-500 ${stepsAnimClass}`}>
            {quickSteps[currentStepsIndex].map((item, i) => (
              <div key={i} className="relative group">
                <div className="flex gap-4 items-start p-4 rounded-xl bg-[#0a0a0a] border border-white/10 hover:bg-[#141414] hover:border-white/30 transition-all duration-300">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center flex-shrink-0 text-black font-bold text-sm relative group-hover:scale-110 transition-transform duration-300`}>
                    <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${item.color} animate-pulse opacity-0 group-hover:opacity-50`}></div>
                    <span className="relative z-10">{item.step}</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-semibold mb-1">{item.title}</div>
                    <div className="text-sm text-zinc-400">{item.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Benefits */}
          <div className={`bg-[#0a0a0a] backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-[#141414] transition-all duration-500 ${benefitsAnimClass}`}>
            <h3 className="text-white font-semibold mb-5 text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>
              What you get today:
            </h3>
            <ul className="space-y-3">
              {benefits[currentBenefitsIndex].map((benefit, i) => (
                <li key={i} className="flex items-start gap-3 text-zinc-300 text-sm group hover:text-white transition-colors duration-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-1.5 group-hover:scale-150 group-hover:shadow-[0_0_8px_rgba(255,255,255,0.6)] transition-all duration-300"></div>
                  <span>{benefit.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Right Side - Signup Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-black overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Back Button */}
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-8"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to plan selection
          </button>

          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-3 mb-6 lg:hidden">
              <div className="logo-glow">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="18" stroke="url(#signupLogoGradient)" strokeWidth="1.5" fill="none" />
                  <circle cx="20" cy="12" r="3" fill="#00fff0" />
                  <circle cx="12" cy="24" r="3" fill="#00fff0" />
                  <circle cx="28" cy="24" r="3" fill="#00fff0" />
                  <circle cx="20" cy="28" r="2" fill="#a855f7" />
                  <line x1="20" y1="15" x2="14" y2="22" stroke="#00fff0" strokeWidth="1.5" opacity="0.6" />
                  <line x1="20" y1="15" x2="26" y2="22" stroke="#00fff0" strokeWidth="1.5" opacity="0.6" />
                  <line x1="14" y1="25" x2="20" y2="28" stroke="#a855f7" strokeWidth="1.5" opacity="0.6" />
                  <line x1="26" y1="25" x2="20" y2="28" stroke="#a855f7" strokeWidth="1.5" opacity="0.6" />
                  <defs>
                    <linearGradient id="signupLogoGradient" x1="0" y1="0" x2="40" y2="40">
                      <stop offset="0%" stopColor="#00fff0" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
            <h2
              className="text-4xl font-bold text-white mb-4"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Create Your Account
            </h2>
            <p className="text-zinc-400">
              {plan === 'teams' ? 'Set up your team workspace' : 'Get started in minutes'}
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                step >= 1 ? 'bg-[#00fff0] text-black' : 'bg-white/5 text-zinc-500'
              }`}>
                1
              </div>
              <span className={`text-sm ${step >= 1 ? 'text-white' : 'text-zinc-500'}`}>Account Info</span>
            </div>
            <div className="w-12 h-px bg-white/10"></div>
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                step >= 2 ? 'bg-[#00fff0] text-black' : 'bg-white/5 text-zinc-500'
              }`}>
                2
              </div>
              <span className={`text-sm ${step >= 2 ? 'text-white' : 'text-zinc-500'}`}>Preferences</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-8">
              {step === 1 ? (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:border-[#00fff0] focus:outline-none transition-colors"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Email Address *
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

                  {plan === 'teams' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                          Company Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.company}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                          className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:border-[#00fff0] focus:outline-none transition-colors"
                          placeholder="Acme Inc."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:border-[#00fff0] focus:outline-none transition-colors"
                          placeholder="+1 (555) 000-0000"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:border-[#00fff0] focus:outline-none transition-colors"
                      placeholder="••••••••"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Confirm Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:border-[#00fff0] focus:outline-none transition-colors"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-white mb-6">Tell us about your business</h3>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      What industry are you in?
                    </label>
                    <select className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white focus:border-[#00fff0] focus:outline-none transition-colors">
                      <option value="">Select industry</option>
                      <option>E-commerce</option>
                      <option>Fashion & Retail</option>
                      <option>Food & Beverage</option>
                      <option>Technology</option>
                      <option>Healthcare</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      How many pages will you manage?
                    </label>
                    <select className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white focus:border-[#00fff0] focus:outline-none transition-colors">
                      <option value="">Select range</option>
                      <option>1-2 pages</option>
                      <option>3-5 pages</option>
                      <option>6-10 pages</option>
                      <option>10+ pages</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Expected monthly messages
                    </label>
                    <select className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white focus:border-[#00fff0] focus:outline-none transition-colors">
                      <option value="">Select range</option>
                      <option>Less than 1,000</option>
                      <option>1,000 - 5,000</option>
                      <option>5,000 - 10,000</option>
                      <option>10,000+</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 px-6 py-4 bg-white/5 border border-white/10 rounded-full text-white font-semibold hover:bg-white/10 transition-colors"
                >
                  Previous
                </button>
              )}
              <button
                type="submit"
                className="flex-1 btn-primary px-6 py-4 rounded-full font-semibold"
              >
                <span>{step === 1 ? 'Continue' : 'Create Account'}</span>
              </button>
            </div>

            <p className="text-center text-sm text-zinc-500">
              Already have an account?{' '}
              <Link href="/login" className="text-[#00fff0] hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
