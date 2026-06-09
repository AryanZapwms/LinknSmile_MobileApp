// services/api.ts
import axios from 'axios';
import { storage } from '../utils/storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://linkn-smile.vercel.app';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// Request interceptor
// Attaches the NextAuth session token as a Cookie header so the backend's
// getServerSession() can validate it — exactly how a browser would send it.
// ─────────────────────────────────────────────────────────────────────────────
api.interceptors.request.use(
  async (config) => {
    const token = await storage.getToken();

    if (token) {
      // NextAuth reads the session from the cookie named:
      //   Development : next-auth.session-token
      //   Production  : __Secure-next-auth.session-token
      const isProduction = API_BASE_URL.startsWith('https://') &&
        !API_BASE_URL.includes('localhost');

      const cookieName = isProduction
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token';

      config.headers['Cookie'] = `${cookieName}=${token}`;

      console.log('🍪 Attaching session cookie:', cookieName, '[value set]');
    } else {
      console.log('⚠️ No session token found in storage');
    }

    console.log('📡 Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => Promise.reject(error)
);

// ─────────────────────────────────────────────────────────────────────────────
// Response interceptor
// Only clears the token on true auth failures — not resource-level 401s.
// ─────────────────────────────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const errorMessage = error.response?.data?.error || error.response?.data?.message || '';

    console.log('❌ Response error:', status, error.config?.url);
    console.log('📨 Error body:', JSON.stringify(error.response?.data));

    if (status === 401) {
      const isTokenInvalid =
        errorMessage.toLowerCase().includes('token') ||
        errorMessage.toLowerCase().includes('expired') ||
        errorMessage.toLowerCase().includes('invalid') ||
        !error.config?.headers?.Cookie; // No cookie was sent at all

      if (isTokenInvalid) {
        console.log('🔐 Session invalid/expired — clearing local auth');
        await storage.deleteToken();
        await storage.deleteUserSession();
        // Navigation to login is handled by the screen/layout
      } else {
        console.log('⚠️ 401 on resource endpoint, keeping session alive');
      }
    }

    return Promise.reject(error);
  }
);