// services/config.ts
// Build-time configuration. EXPO_PUBLIC_* values are inlined into the bundle
// (see .env.example), so nothing here may be a secret.

const trimTrailingSlash = (url: string) => url.replace(/\/+$/, '');

/** Backend base URL. India production unless EXPO_PUBLIC_API_URL overrides it. */
export const API_BASE_URL = trimTrailingSlash(
  process.env.EXPO_PUBLIC_API_URL || 'https://linknsmile.com'
);

/** Razorpay public key id (rzp_live_… / rzp_test_…). Empty = online payment unavailable. */
export const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '';

/** Sentry DSN. Empty = crash reporting disabled. */
export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';
