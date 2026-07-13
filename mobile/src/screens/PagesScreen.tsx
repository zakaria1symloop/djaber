import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { getPages, getPageSummary, Page, PageSummary } from '../api';
import { useI18n } from '../i18n';
import { colors, radius, spacing } from '../theme';

interface Item {
  page: Page;
  summary: PageSummary | null;
}

export default function PagesScreen({ onLoggedOut }: { onLoggedOut: () => void }) {
  const { t } = useI18n();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const pages = await getPages();
      const withSummaries = await Promise.all(
        pages.map(async (page) => {
          try {
            const summary = await getPageSummary(page.id);
            return { page, summary };
          } catch {
            return { page, summary: null };
          }
        })
      );
      setItems(withSummaries);
    } catch (e: any) {
      if (e?.status === 401) {
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
  }, [load]);

  const renderItem = ({ item }: { item: Item }) => {
    const { page, summary } = item;
    const avatar = summary?.pictureUrl || page.pageAvatar || null;
    const aiOn = summary?.agent?.enabled;

    return (
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.avatar}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarLetter}>{page.pageName.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={1}>
              {page.pageName}
            </Text>
            <Text style={styles.platform}>
              {page.platform === 'instagram' ? 'Instagram' : 'Facebook'}
            </Text>
          </View>
          <View style={styles.aiBadge}>
            <View style={[styles.aiDot, aiOn ? styles.aiDotOn : styles.aiDotOff]} />
            <Text style={styles.aiText}>{aiOn ? t('pages.aiOn') : t('pages.aiOff')}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat label={t('pages.stat.convos')} value={summary?.conversations?.total} />
          <Stat label={t('pages.stat.msgs7d')} value={summary?.messages?.last7d} />
          <Stat label={t('pages.stat.unread')} value={summary?.conversations?.unread} />
          <Stat label={t('pages.stat.products')} value={summary?.products} />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('pages.title')}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.white} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.centerText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.page.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor="#fff"
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.centerText}>{t('pages.empty')}</Text>
            </View>
          }
          ListFooterComponent={
            items.length > 0 ? (
              <Text style={styles.hint}>{t('pages.connectHint')}</Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value ?? '–'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  headerTitle: { color: colors.text, fontSize: 24, fontWeight: '800' },
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.md },
  centerText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%', opacity: 0.9 },
  avatarLetter: { color: colors.textSecondary, fontSize: 20, fontWeight: '700' },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  platform: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiDot: { width: 7, height: 7, borderRadius: 4 },
  aiDotOn: { backgroundColor: colors.white },
  aiDotOff: { borderWidth: 1, borderColor: colors.textFaint },
  aiText: { color: colors.textSecondary, fontSize: 11 },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  stat: { flex: 1 },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  statLabel: { color: colors.textFaint, fontSize: 10, marginTop: 2, textTransform: 'uppercase' },
  hint: {
    color: colors.textFaint,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: 30,
  },
});
