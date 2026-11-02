// services/notification.service.ts against a fake backend and a fake OS: signing
// in never shows the permission prompt, the prompt only follows the explanation,
// and a "no" is respected.
// Faked: the network, expo-notifications, expo-device, storage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Alert, type AlertButton } from 'react-native';
import { offerPushNotifications, registerForPushNotifications } from '../services/notification.service';
import { tokenStore } from '../services/token-store';
import { json, network, sleep, tokenResponse } from '../test-utils/fake-network';

jest.mock('expo-secure-store', () => require('../test-utils/mock-secure-store'));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'project-id' } } } },
}));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[device]' })),
  addPushTokenListener: jest.fn(() => ({ remove: () => {} })),
  AndroidImportance: { MAX: 5 },
}));

const getPermissions = jest.mocked(Notifications.getPermissionsAsync);
const requestPermissions = jest.mocked(Notifications.requestPermissionsAsync);

const permission = (status: string, canAskAgain = true) => ({ status, canAskAgain }) as never;
// What Android 13+ reports before the user has ever been asked.
const NOT_ASKED_YET = permission('denied');

const OFFER = { title: 'Get alerts?', message: 'Why it helps.' };
const DAY = 24 * 60 * 60 * 1000;

const PUSH_TOKEN_URL = '/api/users/push-token';

network.handle(({ url, method }) =>
  url === PUSH_TOKEN_URL && method === 'POST' ? json(200, { success: true }) : json(404, {})
);

const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

/** Presses a button of the explanation that is on screen, and lets it finish. */
async function press(label: 'Not now' | 'Turn on') {
  const buttons = alert.mock.lastCall?.[2] as AlertButton[];
  buttons.find((b) => b.text === label)?.onPress?.();
  await sleep(20);
}

beforeEach(async () => {
  jest.clearAllMocks();
  network.clear();
  await AsyncStorage.clear();
  await tokenStore.save(tokenResponse('access', 'rt_refresh'));
});

describe('registering at sign-in', () => {
  it('never shows the permission prompt', async () => {
    getPermissions.mockResolvedValue(NOT_ASKED_YET);
    await registerForPushNotifications();
    expect(requestPermissions).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    expect(network.count(PUSH_TOKEN_URL)).toBe(0);
  });

  it('registers the token when push is already allowed', async () => {
    getPermissions.mockResolvedValue(permission('granted'));
    await registerForPushNotifications();
    expect(network.find(PUSH_TOKEN_URL, 'POST')?.data).toEqual({ token: 'ExponentPushToken[device]', platform: 'ios' });
  });
});

describe('offering push', () => {
  it('explains first: no OS prompt until the user agrees', async () => {
    getPermissions.mockResolvedValue(NOT_ASKED_YET);
    await offerPushNotifications(OFFER);
    expect(alert).toHaveBeenCalledWith(OFFER.title, OFFER.message, expect.any(Array));
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it('Turn on: shows the OS prompt, then registers the token', async () => {
    getPermissions.mockResolvedValueOnce(NOT_ASKED_YET).mockResolvedValue(permission('granted'));
    requestPermissions.mockResolvedValue(permission('granted'));
    await offerPushNotifications(OFFER);
    await press('Turn on');
    expect(requestPermissions).toHaveBeenCalledTimes(1);
    expect(network.count(PUSH_TOKEN_URL, 'POST')).toBe(1);
  });

  it('Turn on, then denied at the OS prompt: nothing registered, not offered again for 30 days', async () => {
    getPermissions.mockResolvedValue(NOT_ASKED_YET);
    requestPermissions.mockResolvedValue(permission('denied'));
    await offerPushNotifications(OFFER);
    await press('Turn on');
    expect(network.count(PUSH_TOKEN_URL)).toBe(0);

    alert.mockClear();
    await offerPushNotifications(OFFER);
    expect(alert).not.toHaveBeenCalled();
  });

  it('Not now: no OS prompt, and not offered again until 30 days have passed', async () => {
    getPermissions.mockResolvedValue(NOT_ASKED_YET);
    await offerPushNotifications(OFFER);
    await press('Not now');
    expect(requestPermissions).not.toHaveBeenCalled();

    alert.mockClear();
    await offerPushNotifications(OFFER);
    expect(alert).not.toHaveBeenCalled();

    const now = Date.now();
    const later = jest.spyOn(Date, 'now').mockReturnValue(now + 31 * DAY);
    await offerPushNotifications(OFFER);
    later.mockRestore();
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('does nothing when push is already allowed', async () => {
    getPermissions.mockResolvedValue(permission('granted'));
    await offerPushNotifications(OFFER);
    expect(alert).not.toHaveBeenCalled();
  });

  it('does nothing when the OS will not ask again', async () => {
    getPermissions.mockResolvedValue(permission('denied', false));
    await offerPushNotifications(OFFER);
    expect(alert).not.toHaveBeenCalled();
  });
});
