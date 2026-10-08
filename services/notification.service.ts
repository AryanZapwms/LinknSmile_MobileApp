// services/notification.service.ts
// Push notifications: ask permission, get this device's Expo push token and
// register it for the signed-in user (POST /api/users/push-token). The token
// is remembered locally so logout can unregister it.

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiClient } from './api-client';
import { tokenStore } from './token-store';

// How notifications appear while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let tokenListener: Notifications.EventSubscription | null = null;

/**
 * Registers this device for the signed-in user. Safe to call on every app
 * start and after every login: it never throws and never shows an alert
 * (simulators and denied permission simply mean "no push").
 */
export async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;

  try {
    // Android 13+ only shows the permission prompt once a channel exists.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'General',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!(await tokenStore.load())) return; // signed out while we were asking

    await apiClient.users.registerPushToken({
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    await tokenStore.setPushToken(token);

    // The OS can replace the device token at any time: register again then.
    tokenListener ??= Notifications.addPushTokenListener(() => {
      void registerForPushNotifications();
    });
  } catch (error) {
    if (__DEV__) console.warn('[push] registration failed:', error);
  }
}
