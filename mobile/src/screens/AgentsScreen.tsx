import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { getAgents, updateAgent, Agent } from '../api';
import { useI18n } from '../i18n';
import { colors, radius, spacing } from '../theme';

interface Props {
  onEditAgent: (agent: Agent) => void;
  onLoggedOut: () => void;
}

export default function AgentsScreen({ onEditAgent, onLoggedOut }: Props) {
  const { t } = useI18n();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setAgents(await getAgents());
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

  const toggleActive = async (agent: Agent, value: boolean) => {
    // optimistic flip
    setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, isActive: value } : a)));
    try {
      await updateAgent(agent.id, { isActive: value });
    } catch {
      // revert on failure
      setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, isActive: !value } : a)));
    }
  };

  const renderItem = ({ item }: { item: Agent }) => (
    <TouchableOpacity style={styles.card} onPress={() => onEditAgent(item)} activeOpacity={0.7}>
      <View style={styles.iconBox}>
        <Text style={styles.iconText}>✦</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        {!!item.description && (
          <Text style={styles.desc} numberOfLines={1}>
            {item.description}
          </Text>
        )}
        <Text style={styles.meta}>
          {t(`agent.p.${item.personality}`) !== `agent.p.${item.personality}`
            ? t(`agent.p.${item.personality}`)
            : item.personality}
          {'  ·  '}
          {item._count?.pages ?? item.pages?.length ?? 0} {t('agents.pages')}
          {'  ·  '}
          {item._count?.products ?? 0} {t('agents.products')}
        </Text>
      </View>
      <View style={styles.right}>
        <Switch
          value={item.isActive}
          onValueChange={(v) => toggleActive(item, v)}
          trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(255,255,255,0.6)' }}
          thumbColor={item.isActive ? colors.white : colors.textMuted}
        />
        <Text style={styles.stateText}>
          {item.isActive ? t('agents.active') : t('agents.inactive')}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('agents.title')}</Text>
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
          data={agents}
          keyExtractor={(a) => a.id}
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
              <Text style={styles.centerText}>{t('agents.empty')}</Text>
            </View>
          }
        />
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: colors.text, fontSize: 18 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  desc: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  meta: { color: colors.textFaint, fontSize: 11, marginTop: 4 },
  right: { alignItems: 'center', gap: 2 },
  stateText: { color: colors.textFaint, fontSize: 9, textTransform: 'uppercase' },
});
