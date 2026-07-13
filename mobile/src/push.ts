import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerDevice } from './api';

const PUSH_TOKEN_KEY = 'pushToken';

/**
 * Expo Go on Android removed remote-push support (SDK 53+): merely loading
 * expo-notifications there spams errors. So the module is loaded LAZILY and
 * only outside Expo Go Android — core app stays clean while debugging.
 */
export const isExpoGoAndroid =
  Constants.appOwnership === 'expo' && Platform.OS === 'android';

function loadNotifications(): typeof import('expo-notifications') | null {
  if (isExpoGoAndroid) return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('expo-notifications');
}

let handlerConfigured = false;
function ensureHandler(N: typeof import('expo-notifications')): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  // Show notifications as banners even while the app is in the foreground
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Last successfully registered token, persisted so logout can unregister it. */
export async function getStoredPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

export async function clearStoredPushToken(): Promise<void> {
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY).catch(() => {});
}

/**
 * Subscribe to "user tapped a notification" events.
 * Safe no-op in Expo Go on Android. Returns an unsubscribe function.
 */
export function addNotificationTapListener(
  onConversation: (conversationId: string) => void
): () => void {
  const N = loadNotifications();
  if (!N) return () => {};
  ensureHandler(N);
  const sub = N.addNotificationResponseReceivedListener((response) => {
    const data: any = response.notification.request.content.data || {};
    if (data.conversationId) onConversation(String(data.conversationId));
  });
  return () => sub.remove();
}

/**
 * If the app was cold-started by tapping a notification, return that
 * notification's conversationId. Safe null in Expo Go on Android.
 */
export async function getInitialNotificationConversationId(): Promise<string | null> {
  try {
    const N = loadNotifications();
    if (!N) return null;
    const response = await N.getLastNotificationResponseAsync();
    const data: any = response?.notification.request.content.data || {};
    return data.conversationId ? String(data.conversationId) : null;
  } catch {
    return null;
  }
}

/**
 * Ask permission, fetch the Expo push token and register it with the backend.
 * Returns the token, or null when push isn't available (emulator, Expo Go on
 * Android, permission denied, no EAS projectId yet). Never throws.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null; // emulators can't receive push

    const N = loadNotifications();
    if (!N) {
      console.log('Push not supported in Expo Go on Android — will work in the built APK');
      return null;
    }
    ensureHandler(N);

    const { status: existing } = await N.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await N.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('default', {
        name: 'Djaber',
        importance: N.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    // getExpoPushTokenAsync THROWS without a projectId (set by `eas init`).
    // Until EAS is configured, push is explicitly disabled instead of silently failing.
    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    if (!projectId) {
      console.log('Push disabled: no EAS projectId configured yet (run `eas init`)');
      return null;
    }

    const tokenResponse = await N.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse.data;
    if (!token) return null;

    await registerDevice(token, Platform.OS);
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token).catch(() => {});
    console.log('Push token registered:', token);
    return token;
  } catch (err: any) {
    console.log('Push registration skipped:', err?.message);
    return null;
  }
}
