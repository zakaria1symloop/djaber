import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { I18nProvider } from './src/i18n';
import { getToken } from './src/api/client';
import {
  registerForPushNotifications,
  addNotificationTapListener,
  getInitialNotificationConversationId,
} from './src/push';
import LoginScreen from './src/screens/LoginScreen';
import InboxScreen from './src/screens/InboxScreen';
import ConversationScreen from './src/screens/ConversationScreen';
import { colors } from './src/theme';

type Screen =
  | { name: 'loading' }
  | { name: 'login' }
  | { name: 'inbox' }
  | { name: 'conversation'; conversationId: string; title: string };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'loading' });
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
        setScreen({ name: 'inbox' });
      }
    })();
  }, []);

  // Tapping a push notification while the app is running opens that conversation
  // (only when authenticated — never from the login/loading screens)
  useEffect(() => {
    const unsubscribe = addNotificationTapListener((conversationId) => {
      if (screenRef.current.name !== 'login' && screenRef.current.name !== 'loading') {
        setScreen({ name: 'conversation', conversationId, title: '' });
      }
    });
    return unsubscribe;
  }, []);

  return (
    <I18nProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        {screen.name === 'loading' && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.white} />
          </View>
        )}
        {screen.name === 'login' && (
          <LoginScreen onLoggedIn={() => setScreen({ name: 'inbox' })} />
        )}
        {screen.name === 'inbox' && (
          <InboxScreen
            onOpenConversation={(conversationId, title) =>
              setScreen({ name: 'conversation', conversationId, title })
            }
            onLoggedOut={() => setScreen({ name: 'login' })}
          />
        )}
        {screen.name === 'conversation' && (
          <ConversationScreen
            key={screen.conversationId} // remount on switch so thread A never bleeds into thread B
            conversationId={screen.conversationId}
            title={screen.title}
            onBack={() => setScreen({ name: 'inbox' })}
          />
        )}
      </View>
    </I18nProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
