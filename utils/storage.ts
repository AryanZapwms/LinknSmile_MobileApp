// utils/storage.ts
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'auth_token';
const SESSION_KEY = 'user_session';

export const storage = {
  // ─── Token (NextAuth session token value) ───────────────────────────────────

  async setToken(token: string) {
    console.log('💾 Saving token to SecureStore');
    if (Platform.OS === 'web') {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  },

  async getToken(): Promise<string | null> {
    console.log('🔍 Getting token from storage');
    if (Platform.OS === 'web') {
      return localStorage.getItem(TOKEN_KEY);
    } else {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    }
  },

  async deleteToken() {
    console.log('🗑️ Deleting token from storage');
    if (Platform.OS === 'web') {
      localStorage.removeItem(TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  },

  // ─── User Session (full NextAuth session object as JSON string) ─────────────

  async setUserSession(session: string) {
    console.log('💾 Saving user session');
    if (Platform.OS === 'web') {
      localStorage.setItem(SESSION_KEY, session);
    } else {
      await SecureStore.setItemAsync(SESSION_KEY, session);
    }
  },

  async getUserSession(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(SESSION_KEY);
    } else {
      return await SecureStore.getItemAsync(SESSION_KEY);
    }
  },

  async deleteUserSession() {
    if (Platform.OS === 'web') {
      localStorage.removeItem(SESSION_KEY);
    } else {
      // SecureStore throws if key doesn't exist — guard it
      try {
        await SecureStore.deleteItemAsync(SESSION_KEY);
      } catch (_) {}
    }
  },
};