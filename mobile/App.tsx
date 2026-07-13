import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { I18nProvider, useI18n } from './src/i18n';
import { getToken } from './src/api/client';
import { Agent } from './src/api';
import {
  registerForPushNotifications,
  addNotificationTapListener,
  getInitialNotificationConversationId,
} from './src/push';
import LoginScreen from './src/screens/LoginScreen';
import InboxScreen from './src/screens/InboxScreen';
import ConversationScreen from './src/screens/ConversationScreen';
import PagesScreen from './src/screens/PagesScreen';
import AgentsScreen from './src/screens/AgentsScreen';
import AgentEditScreen from './src/screens/AgentEditScreen';
import { colors, spacing } from './src/theme';

type Tab = 'inbox' | 'pages' | 'agents';

type Screen =
  | { name: 'loading' }
  | { name: 'login' }
  | { name: 'main' }
  | { name: 'conversation'; conversationId: string; title: string }
  | { name: 'agentEdit'; agent: Agent };

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const { t } = useI18n();
  const TABS: { key: Tab; icon: string; label: string }[] = [
    { key: 'inbox', icon: '✉', label: t('tab.inbox') },
    { key: 'pages', icon: '▣', label: t('tab.pages') },
    { key: 'agents', icon: '✦', label: t('tab.agents') },
  ];
  return (
    <View style={styles.tabBar}>
      {TABS.map(({ key, icon, label }) => {
        const active = tab === key;
        return (
          <TouchableOpacity key={key} style={styles.tabItem} onPress={() => onChange(key)}>
            <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{icon}</Text>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Root() {
  const [screen, setScreen] = useState<Screen>({ name: 'loading' });
  const [tab, setTab] = useState<Tab>('inbox');
  const screenRef = useRef(screen);
  screenRef.current = screen;

  // Auth gate on startup — the cold-start notification check is sequenced AFTER
  // the token read so the two async reads can't race and stomp each other.
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        setScreen({ name: 'login' });
        return;
      }
      registerForPushNotifications().catch(() => {});

      // Cold start from a notification tap → deep-link into that conversation
      const conversationId = await getInitialNotificationConversationId();
      if (conversationId) {
        setScreen({ name: 'conversation', conversationId, title: '' });
      } else {
        setScreen({ name: 'main' });
      }
    })();
  }, []);

  // Tapping a push notification while the app is running opens that conversation
  // (only when authenticated — never from the login/loading screens)
  useEffect(() => {
    const unsubscribe = addNotificationTapListener((conversationId) => {
      if (screenRef.current.name !== 'login' && screenRef.current.name !== 'loading') {
        setTab('inbox');
        setScreen({ name: 'conversation', conversationId, title: '' });
      }
    });
    return unsubscribe;
  }, []);

  const onLoggedOut = () => setScreen({ name: 'login' });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {screen.name === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.white} />
        </View>
      )}
      {screen.name === 'login' && (
        <LoginScreen
          onLoggedIn={() => {
            setTab('inbox');
            setScreen({ name: 'main' });
          }}
        />
      )}
      {screen.name === 'main' && (
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            {tab === 'inbox' && (
              <InboxScreen
                onOpenConversation={(conversationId, title) =>
                  setScreen({ name: 'conversation', conversationId, title })
                }
                onLoggedOut={onLoggedOut}
              />
            )}
            {tab === 'pages' && <PagesScreen onLoggedOut={onLoggedOut} />}
            {tab === 'agents' && (
              <AgentsScreen
                onEditAgent={(agent) => setScreen({ name: 'agentEdit', agent })}
                onLoggedOut={onLoggedOut}
              />
            )}
          </View>
          <TabBar tab={tab} onChange={setTab} />
        </View>
      )}
      {screen.name === 'conversation' && (
        <ConversationScreen
          key={screen.conversationId} // remount on switch so thread A never bleeds into thread B
          conversationId={screen.conversationId}
          title={screen.title}
          onBack={() => setScreen({ name: 'main' })}
        />
      )}
      {screen.name === 'agentEdit' && (
        <AgentEditScreen
          key={screen.agent.id}
          agent={screen.agent}
          onBack={() => setScreen({ name: 'main' })}
          onSaved={() => setScreen({ name: 'main' })}
        />
      )}
    </View>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <Root />
    </I18nProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    backgroundColor: colors.bg,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: spacing.sm,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { color: colors.textFaint, fontSize: 18 },
  tabIconActive: { color: colors.white },
  tabLabel: { color: colors.textFaint, fontSize: 10, fontWeight: '600' },
  tabLabelActive: { color: colors.white },
});
