// services/token-store.ts
// The signed-in session: access token (15 min), refresh token (30 days,
// 90-day absolute cap enforced by the server) and the user they belong to.
//
// Stored as ONE record in expo-secure-store (Keychain / Keystore), so a
// refresh, which replaces both tokens, is written atomically: the app can
// never end up with a new access token and an already-rotated refresh token.
// A copy is kept in memory so requests don't hit secure storage every time.

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { AuthUserDto, TokenPairDto } from '../contracts';

export interface StoredSession extends TokenPairDto {
  user: AuthUserDto;
}

const SESSION_KEY = 'lns_session_v1';
const PUSH_TOKEN_KEY = 'lns_push_token';
/** Keys written by app versions before the Bearer scheme (spoofed cookie token). */
const LEGACY_KEYS = ['auth_token', 'user_session'];

// expo-secure-store has no web implementation; the web target is for local
// development only, so localStorage is an acceptable stand-in there.
const backend = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(key);
      return;
    }
    // deleteItemAsync can throw when the key doesn't exist on some devices.
    await SecureStore.deleteItemAsync(key).catch(() => {});
  },
};

let cached: StoredSession | null = null;
let loaded = false;

function parseSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredSession>;
    if (value.accessToken && value.refreshToken && value.user?.id) return value as StoredSession;
  } catch {
    // fall through: unreadable record is treated as "not signed in"
  }
  return null;
}

async function readFromDisk(): Promise<StoredSession | null> {
  cached = parseSession(await backend.get(SESSION_KEY));
  loaded = true;
  return cached;
}

export const tokenStore = {
  /** The stored session, read from secure storage on first use. */
  async load(): Promise<StoredSession | null> {
    if (loaded) return cached;
    await Promise.all(LEGACY_KEYS.map((key) => backend.remove(key)));
    return readFromDisk();
  },

  /** Re-reads secure storage, bypassing the in-memory copy. */
  reload: readFromDisk,

  async save(session: StoredSession): Promise<void> {
    cached = session;
    loaded = true;
    await backend.set(SESSION_KEY, JSON.stringify(session));
  },

  async clear(): Promise<void> {
    cached = null;
    loaded = true;
    await backend.remove(SESSION_KEY);
  },

  async getAccessToken(): Promise<string | null> {
    return (await this.load())?.accessToken ?? null;
  },

  async getRefreshToken(): Promise<string | null> {
    return (await this.load())?.refreshToken ?? null;
  },

  // The Expo push token registered for this device, kept so logout can ask
  // the server to stop sending this user's notifications here.
  getPushToken: () => backend.get(PUSH_TOKEN_KEY),
  setPushToken: (token: string) => backend.set(PUSH_TOKEN_KEY, token),
  clearPushToken: () => backend.remove(PUSH_TOKEN_KEY),
};

/** True when an ISO timestamp is in the past (or unreadable). */
export function isExpired(isoTimestamp: string | undefined, now = Date.now()): boolean {
  const time = isoTimestamp ? Date.parse(isoTimestamp) : NaN;
  return Number.isNaN(time) || time <= now;
}
