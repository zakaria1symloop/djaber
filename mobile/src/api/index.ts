import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setToken } from './client';

// ---------- Types (mirror backend responses) ----------

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  plan: string;
}

export interface Page {
  id: string;
  platform: 'facebook' | 'instagram';
  pageId: string;
  pageName: string;
  pageAvatar?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  senderId: string;
  senderName: string | null;
  status: 'active' | 'resolved' | 'archived';
  aiPaused?: boolean;
  platform?: string;
  lastMessage: { text: string | null; timestamp: string; isFromPage: boolean } | null;
  createdAt: string;
  updatedAt: string;
  // added client-side
  page?: Page;
}

export interface Message {
  id: string;
  text: string | null;
  timestamp: string;
  isFromPage: boolean;
  senderId: string;
  attachmentType?: string | null;
  attachmentUrl?: string | null;
}

export interface ConversationDetail {
  id: string;
  senderName: string | null;
  senderId: string;
  status: string;
  platform: string;
  aiPaused?: boolean;
}

// ---------- Auth ----------

export async function login(email: string, password: string): Promise<User> {
  const res = await api<{ token: string; user: User }>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
  await setToken(res.token);
  return res.user;
}

export async function register(
  firstName: string,
  lastName: string,
  email: string,
  password: string
): Promise<User> {
  const res = await api<{ token: string; user: User }>('/api/auth/register', {
    method: 'POST',
    body: { firstName, lastName, email, password },
    auth: false,
  });
  await setToken(res.token);
  return res.user;
}

export async function logout(): Promise<void> {
  // Unregister this device's push token BEFORE clearing auth (endpoint needs the JWT),
  // so a logged-out phone stops receiving the account's notifications.
  const pushToken = await AsyncStorage.getItem('pushToken').catch(() => null);
  if (pushToken) {
    await api('/api/devices/unregister', { method: 'POST', body: { token: pushToken } }).catch(
      () => {}
    );
    await AsyncStorage.removeItem('pushToken').catch(() => {});
  }
  await setToken(null);
}

// ---------- Pages & conversations ----------

export async function getPages(): Promise<Page[]> {
  const res = await api<{ pages: Page[] }>('/api/pages');
  return res.pages;
}

export async function getPageConversations(
  pageId: string,
  status: 'all' | 'active' | 'resolved' | 'archived' = 'all'
): Promise<ConversationSummary[]> {
  const res = await api<{ conversations: ConversationSummary[] }>(
    `/api/pages/${pageId}/conversations?status=${status}&limit=50`
  );
  return res.conversations;
}

export async function getConversationMessages(
  conversationId: string
): Promise<{ conversation: ConversationDetail; messages: Message[] }> {
  return api(`/api/pages/conversations/${conversationId}/messages`);
}

export async function sendReply(conversationId: string, message: string): Promise<void> {
  await api(`/api/pages/conversations/${conversationId}/reply`, {
    method: 'POST',
    body: { message },
  });
}

/** Setting status to 'active' also resumes the AI (clears aiPaused) */
export async function setConversationStatus(
  conversationId: string,
  status: 'active' | 'resolved' | 'archived'
): Promise<void> {
  await api(`/api/pages/conversations/${conversationId}`, {
    method: 'PATCH',
    body: { status },
  });
}

// ---------- Page summary (dashboard card stats) ----------

export interface PageSummary {
  id: string;
  platform: string;
  pageId: string;
  pageName: string;
  pictureUrl: string | null;
  conversations: { total: number; active: number; resolved: number; archived: number; unread: number };
  messages: { last7d: number; last24h: number; incoming7d: number; outgoing7d: number };
  products: number;
  agent: {
    id: string | null;
    name: string | null;
    enabled: boolean;
    autoReply: boolean;
    personality: string | null;
    hasInstructions: boolean;
  };
  lastActivity: string | null;
}

export async function getPageSummary(pageId: string): Promise<PageSummary> {
  const res = await api<{ summary: PageSummary }>(`/api/pages/${pageId}/summary`);
  // some deployments return the object directly
  return (res as any).summary ?? (res as any);
}

// ---------- Agents ----------

export interface AgentPageRef {
  page: { id: string; pageName: string; platform: string; pageId: string; isActive: boolean };
}

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  personality: string;
  customInstructions: string | null;
  humanHandoffRules: string | null;
  aiModel: string;
  isActive: boolean;
  imageRecognition?: boolean;
  voiceTranscription?: boolean;
  sellAllProducts?: boolean;
  pages: AgentPageRef[];
  _count?: { pages: number; products: number };
  createdAt?: string;
}

export async function getAgents(): Promise<Agent[]> {
  const res = await api<{ agents: Agent[] }>('/api/user-stock/agents');
  return res.agents;
}

export interface AgentPatch {
  name?: string;
  description?: string;
  personality?: string;
  customInstructions?: string;
  humanHandoffRules?: string;
  isActive?: boolean;
}

export async function updateAgent(agentId: string, patch: AgentPatch): Promise<void> {
  await api(`/api/user-stock/agents/${agentId}`, { method: 'PUT', body: patch });
}

// ---------- Devices (push) ----------

export async function registerDevice(token: string, platform: string): Promise<void> {
  await api('/api/devices/register', { method: 'POST', body: { token, platform } });
}
