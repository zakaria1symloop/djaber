import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { getPages, getPageConversations, logout, Page, ConversationSummary } from '../api';
import { useI18n, Lang } from '../i18n';
import { colors, radius, spacing } from '../theme';

const LANGS: Lang[] = ['en', 'fr', 'ar'];

interface Props {
  onOpenConversation: (conversationId: string, title: string) => void;
  onLoggedOut: () => void;
}

export default function InboxScreen({ onOpenConversation, onLoggedOut }: Props) {
  const { t, lang, setLang } = useI18n();
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const pages = await getPages();
      const perPage = await Promise.all(
        pages.map(async (page: Page) => {
          try {
            const convs = await getPageConversations(page.id, 'all');
            return convs.map((c) => ({ ...c, page }));
          } catch {
            return [] as ConversationSummary[];
          }
        })
      );
      const merged = perPage.flat();
      // "Needs human" first, then most recent
      merged.sort((a, b) => {
        if (!!a.aiPaused !== !!b.aiPaused) return a.aiPaused ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      setItems(merged);
    } catch (e: any) {
      if (e?.status === 401) {
        await logout(); // clear the dead/expired token so cold starts go straight to login
        onLoggedOut();
        return;
      }
      setError(e?.message || t('common.error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t, onLoggedOut]);

  useEffect(() => {
    load();
    // light auto-refresh so new messages appear without manual pulls
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const confirmLogout = () => {
    Alert.alert(t('inbox.logout'), '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: t('inbox.logout'),
        style: 'destructive',
        onPress: async () => {
          await logout();
          onLoggedOut();
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: ConversationSummary }) => {
    const name = item.senderName || t('common.customer');
    const preview = item.lastMessage?.text || '📎';
    const awaiting = item.lastMessage && !item.lastMessage.isFromPage;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => onOpenConversation(item.id, name)}
        activeOpacity={0.7}
      >
        <View style={styles.avatar}>
          {item.page?.pageAvatar ? (
            <Image source={{ uri: item.page.pageAvatar }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarLetter}>{name.charAt(0).toUpperCase()}</Text>
          )}
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.time}>{timeAgo(item.updatedAt, t)}</Text>
          </View>
          <Text style={[styles.preview, awaiting && styles.previewUnread]} numberOfLines={1}>
            {preview}
          </Text>
          <View style={styles.tagRow}>
            <Text style={styles.pageTag} numberOfLines={1}>
              {item.page?.platform === 'instagram' ? 'IG' : 'FB'} · {item.page?.pageName}
            </Text>
            {item.aiPaused ? (
              <View style={styles.needsHumanTag}>
                <Text style={styles.needsHumanText}>🤝 {t('inbox.needsHuman')}</Text>
              </View>
            ) : (
              <Text style={styles.aiTag}>✦ {t('inbox.aiOn')}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('inbox.title')}</Text>
        <View style={styles.headerRight}>
          {LANGS.map((l) => (
            <TouchableOpacity key={l} onPress={() => setLang(l)} style={styles.langBtn}>
              <Text style={[styles.langText, lang === l && styles.langTextActive]}>
                {l.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={confirmLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>⎋</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.white} />
          <Text style={styles.centerText}>{t('inbox.loading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.centerText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.centerText}>{t('inbox.empty')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function timeAgo(iso: string, t: (k: string) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('common.now');
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  headerTitle: { color: colors.text, fontSize: 24, fontWeight: '800' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  langBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  langText: { color: colors.textFaint, fontSize: 11, fontWeight: '700' },
  langTextActive: { color: colors.white },
  logoutBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  logoutText: { color: colors.textMuted, fontSize: 18 },
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.md },
  centerText: { color: colors.textMuted, fontSize: 14 },
  retryBtn: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  retryText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%', opacity: 0.9 },
  avatarLetter: { color: colors.textSecondary, fontSize: 18, fontWeight: '700' },
  cardBody: { flex: 1, minWidth: 0 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  time: { color: colors.textFaint, fontSize: 11 },
  preview: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  previewUnread: { color: colors.textSecondary, fontWeight: '600' },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  pageTag: { color: colors.textFaint, fontSize: 11, flex: 1, marginRight: 8 },
  needsHumanTag: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  needsHumanText: { color: colors.text, fontSize: 10, fontWeight: '700' },
  aiTag: { color: colors.textFaint, fontSize: 11 },
});
