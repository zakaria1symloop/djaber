import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerDevice } from './api';

const PUSH_TOKEN_KEY = 'pushToken';

// Show notifications as banners even while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Last successfully registered token, persisted so logout can unregister it. */
export async function getStoredPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

export async function clearStoredPushToken(): Promise<void> {
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY).catch(() => {});
}

/**
 * Ask permission, fetch the Expo push token and register it with the backend.
 * Returns the token, or null when push isn't available (emulator, Expo Go on
 * Android SDK 53+, permission denied, no EAS projectId yet). Never throws.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null; // emulators can't receive push

    // Expo Go on Android no longer supports remote push — needs a dev/preview build
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo && Platform.OS === 'android') {
      console.log('Push not supported in Expo Go on Android — will work in the built APK');
      return null;
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Djaber',
        importance: Notifications.AndroidImportance.MAX,
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

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
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
