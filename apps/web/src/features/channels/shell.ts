'use client';
// Shell hooks of the channels module (02-next-route-map §2.1): the `reconnect` and `approvalPending` banners, and the
// WS `channel.updated` handler that keeps the cached pages fresh. Mounted once by MerchantShell.
import { useQueryClient } from '@tanstack/react-query';
import type { ShellBanner } from '@/components/shell/banner-stack';
import { useRouter } from '@/i18n/navigation';
import { useT } from '@/lib/i18n';
import { useSession, useWorkspaceId } from '@/lib/session';
import { useWsEvent } from '@/lib/ws';
import { channelKeys, useChannels } from './api';
import type { Channel, ChannelsList, WsChannelUpdated } from './contracts';
import { bannerChannels } from './logic';

/** "Page « … » : jeton Meta expiré" (Reconnecter → the page) and "Instagram … en attente d'approbation Meta". */
export function useChannelBanners(): ShellBanner[] {
  const t = useT();
  const router = useRouter();
  const { can, workspace } = useSession();
  const q = useChannels(can('channels.read') && workspace?.status !== 'suspended');
  const { reconnect, pending } = bannerChannels(q.data?.rows ?? []);
  const banners: ShellBanner[] = [];
  if (reconnect) {
    banners.push({
      id: 'reconnect',
      tone: 'danger',
      content: t('banner.reconnect', { page: reconnect.name }),
      action: { label: t('action.reconnect'), onClick: () => router.push(`/channels/${reconnect.id}`) },
    });
  }
  if (pending) banners.push({ id: 'approvalPending', tone: 'info', content: t('banner.approvalPending', { account: pending.name }) });
  return banners;
}

/**
 * WS `channel.updated { channel: { id, status, pausedReason, agentId, lastSeenAt } }`: status and pause reason are
 * patched in place; everything derived by the server (actions, counts, health, plan limit) is refetched.
 */
export function useChannelEvents() {
  const ws = useWorkspaceId();
  const qc = useQueryClient();
  useWsEvent<WsChannelUpdated>('channel.updated', (p) => {
    const u = p?.channel;
    if (!u?.id) return;
    const patch = <T extends Channel>(c: T): T => (c.id === u.id ? { ...c, status: u.status ?? c.status, pausedReason: u.pausedReason === undefined ? c.pausedReason : u.pausedReason } : c);
    qc.setQueriesData<ChannelsList>({ queryKey: channelKeys.list(ws) }, (old) => (old ? { ...old, rows: old.rows.map(patch) } : old));
    qc.setQueryData<Channel>(channelKeys.one(ws, u.id), (old) => (old ? patch(old) : old));
    void qc.invalidateQueries({ queryKey: channelKeys.all(ws) });
    void qc.invalidateQueries({ queryKey: channelKeys.one(ws, u.id) });
  });
}
