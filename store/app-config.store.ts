// store/app-config.store.ts
// Startup config from GET /api/app-config: which payment methods are on,
// support contacts, legal links and the oldest app version the backend still
// supports. Loaded once at app start; sensible defaults apply until then (and
// if the request fails), and the server enforces the real rules either way.

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { isBelowVersion, type AppConfigResponse } from '../contracts';
import { apiClient } from '../services/api-client';

const FALLBACK = {
  payments: { cod: true, razorpay: true },
  support: { email: 'support@linknsmile.com', phone: '+91 8355991099' },
  links: {
    website: 'https://linknsmile.com',
    privacyPolicy: 'https://linknsmile.com/privacy-policy',
    terms: 'https://linknsmile.com/termsofservice',
    refundPolicy: 'https://linknsmile.com/refund-policy',
  },
} satisfies Pick<AppConfigResponse, 'payments' | 'support' | 'links'>;

/** This build's version (app.json "version"). */
export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

interface AppConfigState {
  config: AppConfigResponse | null;
  /** True when the backend no longer supports this app version. */
  updateRequired: boolean;
  load: () => Promise<void>;
}

export const useAppConfigStore = create<AppConfigState>((set) => ({
  config: null,
  updateRequired: false,

  load: async () => {
    try {
      const config = await apiClient.appConfig();
      const minimum = Platform.OS === 'ios' ? config.minSupportedAppVersion.ios : config.minSupportedAppVersion.android;
      set({ config, updateRequired: isBelowVersion(APP_VERSION, minimum) });
    } catch {
      // Keep whatever we had; the app stays usable on the fallback values.
    }
  },
}));

/** Payment methods to offer at checkout. */
export const usePaymentMethods = () => useAppConfigStore((s) => s.config?.payments ?? FALLBACK.payments);
/** Support email and phone (set by the admin on the website). */
export const useSupportContacts = () => useAppConfigStore((s) => s.config?.support ?? FALLBACK.support);
/** Website, privacy policy, terms and refund policy URLs. */
export const useAppLinks = () => useAppConfigStore((s) => s.config?.links ?? FALLBACK.links);

/** "+91 83559 91099" → "tel:+918355991099" */
export const telUrl = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
/** WhatsApp chat link for a phone number in international format. */
export const whatsappUrl = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`;
