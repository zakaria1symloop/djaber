'use client';

import { useState, useEffect } from 'react';

interface Message {
  id: number;
  sender: 'customer' | 'ai';
  text: string;
  delay: number;
}

const conversation: Message[] = [
  { id: 1, sender: 'customer', text: 'Hi! Do you have this jacket in size M?', delay: 1000 },
  { id: 2, sender: 'ai', text: 'Hi! Yes, we have the Urban Classic Jacket in size M. Would you like me to check our current stock?', delay: 3000 },
  { id: 3, sender: 'customer', text: 'Yes please! What colors do you have?', delay: 5500 },
  { id: 4, sender: 'ai', text: 'We have it in Black, Navy Blue, and Olive Green. All are currently in stock for size M!', delay: 7500 },
  { id: 5, sender: 'customer', text: 'Perfect! How much is it?', delay: 10000 },
  { id: 6, sender: 'ai', text: 'The Urban Classic Jacket is $89.99. We also have a 15% off promotion this week, so it would be $76.49!', delay: 11500 },
  { id: 7, sender: 'customer', text: 'Great! Can you send me the link?', delay: 14000 },
  { id: 8, sender: 'ai', text: 'Of course! Here is the link: shop.fashionstore.com/jacket-ucm-black\n\nWould you like help with anything else?', delay: 15500 },
];

export default function AnimatedDashboard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    if (currentMessageIndex >= conversation.length) {
      // Reset after all messages shown
      const resetTimer = setTimeout(() => {
        setMessages([]);
        setCurrentMessageIndex(0);
      }, 5000);
      return () => clearTimeout(resetTimer);
    }

    const currentMsg = conversation[currentMessageIndex];
    const timer = setTimeout(() => {
      // Show typing indicator
      if (currentMsg.sender === 'ai') {
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          setMessages(prev => [...prev, currentMsg]);
          setCurrentMessageIndex(prev => prev + 1);
        }, 1500);
      } else {
        setMessages(prev => [...prev, currentMsg]);
        setCurrentMessageIndex(prev => prev + 1);
      }
    }, currentMsg.delay);

    return () => clearTimeout(timer);
  }, [currentMessageIndex]);

  return (
    <div className="mt-24 relative">
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10 pointer-events-none" />
      <div className="relative rounded-2xl border border-white/10 overflow-hidden bg-[#0a0a0a] p-1">
        <div className="rounded-xl bg-gradient-to-br from-[#0f0f0f] to-[#0a0a0a] p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex-1 h-8 rounded-lg bg-white/5 flex items-center px-4">
              <span className="text-xs text-zinc-500">dashboard.djaber.ai</span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Sidebar - Connected Pages */}
            <div className="space-y-3">
              <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">Connected Pages</div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg bg-gradient-to-br from-pink-500 to-rose-500">F</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">Fashion Store</div>
                  <div className="text-xs text-zinc-500">Instagram</div>
                </div>
                <div className="w-2 h-2 rounded-full bg-[#00fff0] animate-pulse" />
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 opacity-50">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg bg-gradient-to-br from-blue-500 to-cyan-500">T</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">Tech Support</div>
                  <div className="text-xs text-zinc-500">Facebook</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 opacity-50">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg bg-gradient-to-br from-amber-500 to-orange-500">C</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">Coffee Shop</div>
                  <div className="text-xs text-zinc-500">Instagram</div>
                </div>
              </div>
            </div>

            {/* Main chat area */}
            <div className="md:col-span-2 space-y-4 min-h-[400px]">
              <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">Live Conversation</div>

              {messages.map((msg, index) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.sender === 'ai' ? 'justify-end' : ''} animate-fade-in`}
                  style={{ animationDelay: '0s' }}
                >
                  {msg.sender === 'customer' ? (
                    <>
                      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs flex-shrink-0">JD</div>
                      <div className="flex-1">
                        <div className="bg-white/5 rounded-2xl rounded-tl-sm px-4 py-3 max-w-md">
                          <p className="text-sm text-zinc-300">{msg.text}</p>
                        </div>
                        <span className="text-xs text-zinc-600 mt-1 block">Just now</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 flex flex-col items-end">
                        <div className="bg-gradient-to-r from-[#00fff0]/20 to-[#a855f7]/20 border border-[#00fff0]/20 rounded-2xl rounded-tr-sm px-4 py-3 max-w-md">
                          <p className="text-sm text-white whitespace-pre-line">{msg.text}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-[#00fff0]">AI Agent</span>
                          <span className="text-xs text-zinc-600">Just now</span>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00fff0] to-[#a855f7] flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex gap-3 justify-end animate-fade-in">
                  <div className="flex-1 flex flex-col items-end">
                    <div className="bg-gradient-to-r from-[#00fff0]/20 to-[#a855f7]/20 border border-[#00fff0]/20 rounded-2xl rounded-tr-sm px-4 py-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-[#00fff0] animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 rounded-full bg-[#00fff0] animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 rounded-full bg-[#00fff0] animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[#00fff0]">AI Agent is typing...</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00fff0] to-[#a855f7] flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
