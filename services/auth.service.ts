// services/auth.service.ts
import { api } from './api';
import { storage } from '../utils/storage';
import { useCartStore } from '../store/cart.store';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'vendor' | 'shop_owner';
  shopId?: string | null;
  image?: string;
}

export interface SessionResponse {
  user?: User;
  expires?: string;
}

export const authService = {

  // ✅ Sign in via dedicated mobile endpoint — no CSRF, no cookies needed
  signIn: async (email: string, password: string): Promise<User> => {
    console.log('🔑 Signing in via mobile auth endpoint...');

    const response = await api.post('/api/mobile-auth/login', { email, password });
    const { token, user } = response.data;

    if (!token || !user) {
      throw new Error('Invalid response from server');
    }

    // Save the NextAuth-compatible JWT to SecureStore
    await storage.setToken(token);
    await storage.setUserSession(JSON.stringify(user));

    console.log('✅ Login successful, token saved for user:', user.email);

    // Load cart from server after login
    await authService.loadCartAfterLogin();

    return user;
  },

  // Get current user from local storage (no server call needed)
  getCurrentUser: async (): Promise<User | null> => {
    const sessionStr = await storage.getUserSession();
    if (!sessionStr) return null;
    try {
      return JSON.parse(sessionStr) as User;
    } catch {
      return null;
    }
  },

  // Verify token is still valid by hitting the session endpoint
  getSession: async (): Promise<SessionResponse> => {
    try {
      const response = await api.get('/api/auth/session');
      return response.data;
    } catch (error) {
      console.error('Error getting session:', error);
      return { user: undefined };
    }
  },

  // Sign out — clear all local state
  signOut: async () => {
    console.log('🚪 Signing out...');
    await storage.deleteToken();
    await storage.deleteUserSession();
    const cartStore = useCartStore.getState();
    cartStore.clearCart();
    console.log('✅ Signed out, cleared token and cart');
  },

  // Load cart after login
  loadCartAfterLogin: async () => {
    const cartStore = useCartStore.getState();
    await cartStore.loadCart();
  },
};