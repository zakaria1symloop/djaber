'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Badge } from '@/components/ui';
import { PlusIcon, BotIcon, TrashIcon, EditIcon, MessageIcon } from '@/components/ui/icons';
import { Modal } from '@/components/stock';
import { getAgents, deleteAgentApi, testAgentChat, type Agent } from '@/lib/user-stock-api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Test chat state
  const [chatAgent, setChatAgent] = useState<Agent | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const res = await getAgents();
      setAgents(res.agents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAgents(); }, []);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setDeleting(true);
      await deleteAgentApi(deleteConfirm.id);
      setAgents(agents.filter((a) => a.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent');
    } finally {
      setDeleting(false);
    }
  };

  const openTestChat = (agent: Agent) => {
    setChatAgent(agent);
    setChatMessages([]);
    setChatInput('');
  };

  const closeTestChat = () => {
    setChatAgent(null);
    setChatMessages([]);
    setChatInput('');
  };

  const sendTestMessage = async () => {
    if (!chatAgent || !chatInput.trim() || chatSending) return;

    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput('');
    setChatSending(true);

    try {
      const res = await testAgentChat(chatAgent.id, {
        message: userMsg.content,
        history: chatMessages,
      });
      setChatMessages([...updatedMessages, { role: 'assistant', content: res.response }]);
    } catch (err) {
      setChatMessages([
        ...updatedMessages,
        { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}` },
      ]);
    } finally {
      setChatSending(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const getPersonalityColor = (p: string) => {
    switch (p) {
      case 'professional': return 'bg-blue-500/20 text-blue-400';
      case 'friendly': return 'bg-emerald-500/20 text-emerald-400';
      case 'casual': return 'bg-amber-500/20 text-amber-400';
      case 'technical': return 'bg-violet-500/20 text-violet-400';
      default: return 'bg-zinc-500/20 text-zinc-400';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Agents</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Create and manage AI agents that sell your products on connected pages
          </p>
        </div>
        <Button disabled className="opacity-50 cursor-not-allowed" icon={<PlusIcon className="w-4 h-4" />}>
          New Agent (Coming Soon)
        </Button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline text-xs">dismiss</button>
        </div>
      )}

      {/* Agents Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse h-48 bg-zinc-800 rounded-xl" />
          ))}
        </div>
      ) : agents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors group"
            >
              {/* Agent Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    agent.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-500/20 text-zinc-400'
                  }`}>
                    <BotIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{agent.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPersonalityColor(agent.personality)}`}>
                        {agent.personality}
                      </span>
                      <Badge variant={agent.isActive ? 'success' : 'default'} size="sm">
                        {agent.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openTestChat(agent)}
                    className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                    title="Test chat"
                  >
                    <MessageIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => router.push(`/dashboard/agents/${agent.id}`)}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <EditIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(agent)}
                    className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Description */}
              {agent.description && (
                <p className="text-sm text-zinc-400 mb-4 line-clamp-2">{agent.description}</p>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-black/30 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-zinc-500">Pages</p>
                  <p className="text-lg font-bold text-white">{agent._count?.pages || 0}</p>
                </div>
                <div className="bg-black/30 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-zinc-500">Products</p>
                  <p className="text-lg font-bold text-white">
                    {agent.sellAllProducts ? 'All' : (agent._count?.products || 0)}
                  </p>
                </div>
                <div className="bg-black/30 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-zinc-500">Model</p>
                  <p className="text-xs font-medium text-zinc-300 mt-1">{agent.aiModel}</p>
                </div>
              </div>

              {/* Connected Pages */}
              {agent.pages.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {agent.pages.map((ap) => (
                    <span key={ap.id} className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs">
                      {ap.page.pageName}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-12 text-center">
          <div className="text-zinc-600 mb-4 flex justify-center">
            <BotIcon className="w-16 h-16" />
          </div>
          <h3 className="text-lg font-medium text-zinc-300 mb-1">No Agents Yet</h3>
          <p className="text-sm text-zinc-500 max-w-md mx-auto mb-4">
            Create an AI agent to automatically respond to messages on your connected pages and sell your products.
          </p>
          <Button disabled className="opacity-50 cursor-not-allowed" icon={<PlusIcon className="w-4 h-4" />}>
            Create Agent (Coming Soon)
          </Button>
        </div>
      )}

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Agent" size="sm">
        <p className="text-zinc-400 mb-2">
          Are you sure you want to delete <span className="text-white font-medium">{deleteConfirm?.name}</span>?
          This will disconnect it from all pages.
        </p>
        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)} disabled={deleting}>Cancel</Button>
          <Button type="button" variant="danger" className="flex-1" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Modal>

      {/* Test Chat Modal */}
      <Modal isOpen={!!chatAgent} onClose={closeTestChat} title={`Test — ${chatAgent?.name || 'Agent'}`} size="lg">
        <div className="flex flex-col" style={{ height: '60vh' }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                  <BotIcon className="w-6 h-6" />
                </div>
                <p className="text-zinc-400 text-sm">Send a message to test <span className="text-white font-medium">{chatAgent?.name}</span></p>
                <p className="text-zinc-600 text-xs mt-1">
                  {chatAgent?.personality} personality &middot; {chatAgent?.aiModel}
                </p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-zinc-800 text-zinc-200 border border-white/5 rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {chatSending && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 border border-white/5 rounded-xl rounded-bl-sm px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2 pt-3 border-t border-white/10">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTestMessage(); } }}
              placeholder="Type a message..."
              className="flex-1 bg-zinc-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50"
              disabled={chatSending}
              autoFocus
            />
            <button
              onClick={sendTestMessage}
              disabled={chatSending || !chatInput.trim()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
