import { create } from 'zustand';
import { storage } from '../utils/storage';
import { router } from 'expo-router';
import { authService } from '../services/auth.service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '../services/api';

export type UserRole = 'customer' | 'vendor' | 'shop_owner';

// Single User interface
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  image?: string;
  role: string;
  shopId?: string | null;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  sessionRestored: boolean;
  error: string | null;
  setUser: (user: User | null) => void;        // ✅ added
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  sessionRestored: false,
  error: null,

  setUser: (user) => set({ user }),   // ✅ implement

  login: async (email: string, password: string): Promise<boolean> => {
    set({ isLoading: true, error: null });
    try {
      const user = await authService.signIn(email, password);
      set({ user, isLoading: false, sessionRestored: true, error: null });
      return true;
    } catch (error: any) {
      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        'Login failed. Please try again.';
      console.error('❌ Login error:', message);
      set({ error: message, isLoading: false, sessionRestored: true });
      return false;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    await authService.signOut();
    set({ user: null, isLoading: false, sessionRestored: true });
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const token = await storage.getToken();
      if (!token) {
        console.log('ℹ️ No token found, user not logged in');
        set({ user: null, isLoading: false, sessionRestored: true });
        return;
      }
      const user = await authService.getCurrentUser();
      if (user) {
        console.log('✅ Session restored for:', user.email);
        set({ user, isLoading: false, sessionRestored: true });
      } else {
        console.log('⚠️ Token found but no user session, clearing...');
        await storage.deleteToken();
        await storage.deleteUserSession();
        set({ user: null, isLoading: false, sessionRestored: true });
      }
    } catch (error) {
      console.error('❌ Error restoring session:', error);
      await storage.deleteToken();
      await storage.deleteUserSession();
      set({ user: null, isLoading: false, sessionRestored: true });
    }
  },
}));