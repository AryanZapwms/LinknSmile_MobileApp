// services/notification.service.ts
// Push notifications: get this device's Expo push token and register it for the
// signed-in user (POST /api/users/push-token). The token is remembered locally
// so logout can unregister it.
//
// Registering never asks for permission. The OS prompt only appears after the
// user accepts offerPushNotifications, shown where the reason is obvious.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';
import { apiClient } from './api-client';
import { tokenStore } from './token-store';

/** When the user last said no, here or at the OS prompt. */
const OFFER_DECLINED_AT_KEY = 'push_offer_declined_at';
const ASK_AGAIN_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

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

const pushSupported = () => Platform.OS !== 'web' && Device.isDevice;

async function setUpAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
  });
}

const rememberDeclined = () => AsyncStorage.setItem(OFFER_DECLINED_AT_KEY, String(Date.now()));

/**
 * Registers this device for the signed-in user, if push is already allowed.
 * Safe to call on every app start and after every login: it never throws and
 * never shows an alert or a prompt (simulators and no permission simply mean
 * "no push").
 */
export async function registerForPushNotifications(): Promise<void> {
  if (!pushSupported()) return;

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    await setUpAndroidChannel();

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

async function requestPermissionAndRegister(): Promise<void> {
  try {
    // Android 13+ only shows the permission prompt once a channel exists.
    await setUpAndroidChannel();
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') await registerForPushNotifications();
    else await rememberDeclined();
  } catch (error) {
    if (__DEV__) console.warn('[push] permission request failed:', error);
  }
}

/**
 * Explains why push is useful and, if the user agrees, shows the OS prompt.
 * Does nothing if push is already allowed, the OS will not ask again, or the
 * user said no in the last 30 days. Never throws.
 */
export async function offerPushNotifications({ title, message }: { title: string; message: string }): Promise<void> {
  if (!pushSupported()) return;

  try {
    // Not `status === 'undetermined'`: Android 13+ answers 'denied' until the
    // user has been asked, because notifications are off until then.
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status === 'granted' || !canAskAgain) return;

    const declinedAt = Number(await AsyncStorage.getItem(OFFER_DECLINED_AT_KEY));
    if (Date.now() - declinedAt < ASK_AGAIN_AFTER_MS) return;

    Alert.alert(title, message, [
      { text: 'Not now', style: 'cancel', onPress: () => void rememberDeclined() },
      { text: 'Turn on', onPress: () => void requestPermissionAndRegister() },
    ]);
  } catch (error) {
    if (__DEV__) console.warn('[push] offer failed:', error);
  }
}
