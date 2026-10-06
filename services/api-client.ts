// services/api-client.ts
// The one place the app talks to the backend (docs/mobile-api.md in the web repo).
//
// Auth: `Authorization: Bearer <accessToken>` on every request.
//
// When a signed-in request gets a 401:
//   1. refresh ONCE (POST /api/mobile-auth/refresh), shared by every request
//      that failed at the same moment (single-flight),
//   2. retry the original request ONCE with the new token,
//   3. if the server rejects the refresh, the session is over: tokens are
//      wiped and the app returns to the login screen.
// A request is never retried twice and a refresh is never repeated, so there
// is no retry loop. Login is never retried automatically (it is rate-limited
// to 10/min per IP on the server).
//
// If the refresh could not reach the server at all (offline, timeout, 5xx,
// 429) the user is NOT logged out: being offline is not an expired session.
// The request simply fails and the next one tries again.

import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import type { z, ZodTypeAny } from 'zod';
import * as contracts from '../contracts';
import type { ErrorCode } from '../contracts';
import { ApiError, toApiError } from './api-error';
import { API_BASE_URL } from './config';
import { tokenStore, type StoredSession } from './token-store';

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };
const TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 60_000;

/** Authenticated instance: Bearer header + refresh-and-retry-once. */
export const http = axios.create({ baseURL: API_BASE_URL, timeout: TIMEOUT_MS, headers: JSON_HEADERS });

/** No interceptors: used for login, refresh and app config, which must never trigger a refresh. */
const bare = axios.create({ baseURL: API_BASE_URL, timeout: TIMEOUT_MS, headers: JSON_HEADERS });

// ── Session events ───────────────────────────────────────────────────────────

export type SessionEndReason = ErrorCode | 'NO_REFRESH_TOKEN';

interface SessionListener {
  /** Tokens were refreshed; `session.user` carries the latest role/shop. */
  onSessionUpdated?: (session: StoredSession) => void;
  /** The server ended the session; the app must show the login screen. */
  onSessionEnded?: (reason: SessionEndReason) => void;
}

let sessionListener: SessionListener = {};

/** Registered once by the auth store (kept as a callback to avoid an import cycle). */
export function setSessionListener(listener: SessionListener) {
  sessionListener = listener;
}

// Bumped on every login/logout so a refresh that was already in the air can't
// write its tokens back after the user logged out or switched account.
let sessionEpoch = 0;

async function endSession(reason: SessionEndReason) {
  sessionEpoch++;
  await tokenStore.clear();
  sessionListener.onSessionEnded?.(reason);
}

// ── Refresh (single-flight) ──────────────────────────────────────────────────

type RefreshOutcome = 'refreshed' | 'ended' | 'unavailable';

let refreshInFlight: Promise<RefreshOutcome> | null = null;

async function runRefresh(): Promise<RefreshOutcome> {
  const epoch = sessionEpoch;
  const refreshToken = await tokenStore.getRefreshToken();
  if (!refreshToken) {
    await endSession('NO_REFRESH_TOKEN');
    return 'ended';
  }

  try {
    const response = await bare.post('/api/mobile-auth/refresh', { refreshToken });
    const data = contracts.refreshResponse.parse(response.data);
    if (epoch !== sessionEpoch) return 'ended'; // logged out while refreshing
    const session = toSession(data);
    await tokenStore.save(session);
    sessionListener.onSessionUpdated?.(session);
    return 'refreshed';
  } catch (error) {
    if (epoch !== sessionEpoch) return 'ended';
    const apiError = toApiError(error);

    if (apiError.code === 'REFRESH_TOKEN_ROTATED') {
      // Something else already used this refresh token moments ago. If newer
      // tokens have been stored since, use those; no second refresh call.
      const latest = await tokenStore.reload();
      if (latest && latest.refreshToken !== refreshToken) return 'refreshed';
    }

    // The server answered and said no (invalid, reused, revoked, malformed):
    // the session is over.
    const rejected = apiError.status === 400 || apiError.status === 401 || apiError.status === 403;
    if (rejected) {
      await endSession(apiError.code ?? 'REFRESH_TOKEN_INVALID');
      return 'ended';
    }

    // Offline, timeout, 429, 5xx, unreadable response: the session may well
    // still be valid, so keep it.
    return 'unavailable';
  }
}

async function refreshSession(accessTokenUsed: string | undefined): Promise<RefreshOutcome> {
  // Another request may have refreshed while this one was in the air.
  const current = await tokenStore.getAccessToken();
  if (current && accessTokenUsed && current !== accessTokenUsed) return 'refreshed';

  if (!refreshInFlight) {
    refreshInFlight = runRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// ── Interceptors ─────────────────────────────────────────────────────────────

interface RetriableConfig extends InternalAxiosRequestConfig {
  /** The access token this request was sent with. */
  _accessTokenUsed?: string;
  /** Set once the request has been retried after a refresh. */
  _retried?: boolean;
}

http.interceptors.request.use(async (config: RetriableConfig) => {
  const token = await tokenStore.getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
    config._accessTokenUsed = token;
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.timeout = UPLOAD_TIMEOUT_MS;
  }
  return config;
});

function shouldRefresh(error: AxiosError, config: RetriableConfig | undefined): config is RetriableConfig {
  if (!config || config._retried) return false;
  if (error.response?.status !== 401) return false;
  // Only requests that were sent as a signed-in user can be fixed by a refresh.
  if (!config._accessTokenUsed) return false;
  // Older routes send 401 without a code; newer ones send UNAUTHORIZED. Any
  // other code on a 401 (e.g. INVALID_CREDENTIALS) is not about the token.
  const code = (error.response.data as { code?: string } | undefined)?.code;
  return code === undefined || code === 'UNAUTHORIZED';
}

http.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as RetriableConfig | undefined;
  if (!shouldRefresh(error, config)) throw error;

  config._retried = true;
  const outcome = await refreshSession(config._accessTokenUsed);

  if (outcome === 'refreshed') return http.request(config); // the one retry
  if (outcome === 'ended') {
    throw new ApiError({
      message: 'Your session has expired. Please sign in again.',
      status: 401,
      code: 'UNAUTHORIZED',
    });
  }
  throw new ApiError({
    message: "Couldn't confirm your session. Check your internet connection and try again.",
    isNetworkError: true,
  });
});

// ── Typed helpers ────────────────────────────────────────────────────────────

/** Awaits a request and turns any failure into an ApiError. */
async function unwrap<T>(request: Promise<AxiosResponse<T>>, fallbackMessage?: string): Promise<T> {
  try {
    return (await request).data;
  } catch (error) {
    throw toApiError(error, fallbackMessage);
  }
}

/** Like unwrap, and also checks the response against its contract schema. */
async function unwrapAs<S extends ZodTypeAny>(
  request: Promise<AxiosResponse>,
  schema: S,
  fallbackMessage?: string
): Promise<z.infer<S>> {
  const data = await unwrap(request, fallbackMessage);
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    if (__DEV__) console.warn('[api] response did not match the contract:', parsed.error.issues);
    throw new ApiError({
      message: 'Unexpected response from the server. Please update the app or try again later.',
    });
  }
  return parsed.data;
}

function toSession(data: contracts.MobileLoginResponse | contracts.RefreshResponse): StoredSession {
  return {
    accessToken: data.accessToken,
    accessTokenExpiresAt: data.accessTokenExpiresAt,
    refreshToken: data.refreshToken,
    refreshTokenExpiresAt: data.refreshTokenExpiresAt,
    tokenType: data.tokenType,
    user: data.user,
  };
}

// Request shapes for routes that lib/contracts does not cover yet; they mirror
// the server code (lib/validation.ts registerSchema, app/api/auth/register-vendor).
export interface RegisterCustomerRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}
export interface RegisterVendorRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
  shopName: string;
  description?: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  gstNumber?: string;
  panNumber?: string;
}

export type ShippingAddressInput = z.input<typeof contracts.shippingAddress>;
export interface CheckoutRequest {
  items: contracts.CartItemInputDto[];
  shippingAddress: ShippingAddressInput;
  couponCode?: string;
}

// ── Endpoints ────────────────────────────────────────────────────────────────

export const apiClient = {
  auth: {
    /** Signs in and stores the tokens. Never retried automatically. */
    async login(body: contracts.MobileLoginRequest): Promise<StoredSession> {
      const data = await unwrapAs(
        bare.post('/api/mobile-auth/login', body),
        contracts.mobileLoginResponse,
        'Login failed. Please try again.'
      );
      const session = toSession(data);
      sessionEpoch++;
      await tokenStore.save(session);
      return session;
    },

    /**
     * Revokes the refresh token on the server (and unregisters this device's
     * push token), then wipes local tokens. Local sign-out always succeeds,
     * even offline.
     */
    async logout(): Promise<void> {
      const [session, pushToken] = await Promise.all([tokenStore.load(), tokenStore.getPushToken()]);
      sessionEpoch++;
      await tokenStore.clear();
      await tokenStore.clearPushToken();
      if (!session) return;
      const body: contracts.LogoutRequest = {
        refreshToken: session.refreshToken,
        ...(pushToken ? { pushToken } : {}),
      };
      await bare
        .post('/api/mobile-auth/logout', body, {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        })
        .catch(() => {});
    },

    registerCustomer: (body: RegisterCustomerRequest) =>
      unwrap<{ message: string; email: string }>(
        http.post('/api/auth/register', { ...body, role: 'user' }),
        'Registration failed. Please try again.'
      ),

    registerVendor: (body: RegisterVendorRequest) =>
      unwrap<{ success: boolean; message: string; email: string }>(
        http.post('/api/auth/register-vendor', body),
        'Registration failed. Please try again.'
      ),

    verifyOtp: (email: string, otp: string) =>
      unwrap<{ message: string; role?: string }>(
        http.post('/api/auth/verify-otp', { email, otp }),
        'Invalid or expired code.'
      ),

    resendOtp: (email: string) =>
      unwrap<{ message: string }>(http.post('/api/auth/resend-otp', { email }), 'Could not resend the code.'),

    /** Always answers "sent", whether or not the email has an account. */
    forgotPassword: (email: string) =>
      unwrap<{ message: string }>(http.post('/api/auth/forgot-password', { email }), 'Could not send the code.'),

    verifyResetOtp: (email: string, otp: string) =>
      unwrap<{ message: string }>(
        http.post('/api/auth/verify-reset-otp', { email, otp }),
        'Invalid or expired code.'
      ),

    resetPassword: (email: string, otp: string, newPassword: string) =>
      unwrap<{ message: string }>(
        http.post('/api/auth/reset-password', { email, otp, newPassword }),
        'Could not reset the password.'
      ),

    changePassword: (body: contracts.ChangePasswordRequest) =>
      unwrapAs(
        http.post('/api/auth/change-password', body),
        contracts.changePasswordResponse,
        'Could not change the password.'
      ),
  },

  /** Startup config: minimum app version, payment methods, support contacts, links. */
  appConfig: () => unwrapAs(bare.get('/api/app-config'), contracts.appConfigResponse),

  products: {
    list: (query: Partial<contracts.ProductListQuery> = {}) =>
      unwrapAs(http.get('/api/products', { params: query }), contracts.productListResponse),
  },

  pricing: {
    /** Server-side price for a cart: `totalAmount` is exactly what an order will charge. */
    quote: (body: contracts.QuoteRequest) =>
      unwrapAs(http.post('/api/pricing/quote', body), contracts.quoteResponse, 'Could not price your cart.'),
  },

  addresses: {
    list: () => unwrapAs(http.get('/api/addresses'), contracts.addressListResponse, 'Could not load addresses.'),
    create: (body: contracts.AddressCreateRequest) =>
      unwrapAs(http.post('/api/addresses', body), contracts.address, 'Could not save the address.'),
    update: (id: string, body: Partial<contracts.AddressCreateRequest>) =>
      unwrapAs(http.put(`/api/addresses/${id}`, body), contracts.address, 'Could not save the address.'),
    remove: (id: string) =>
      unwrap<{ message: string }>(http.delete(`/api/addresses/${id}`), 'Could not delete the address.'),
    /** PATCH /api/addresses/:id marks it as the default (and unsets the others). */
    setDefault: (id: string) =>
      unwrapAs(http.patch(`/api/addresses/${id}`), contracts.address, 'Could not set the default address.'),
  },

  cart: {
    // Not schema-checked: carts saved by old app versions lack name/slug.
    get: () => unwrap<{ items?: unknown[] }>(http.get('/api/cart')),
    /** Replaces the whole server cart; prices and stock are re-read from the DB. */
    replace: (body: z.input<typeof contracts.cartPutRequest>) => unwrap<unknown>(http.post('/api/cart', body)),
  },

  favourites: {
    list: () => unwrapAs(http.get('/api/favourites'), contracts.favouriteListResponse, 'Could not load favourites.'),
    /** Toggles: `added` is true if it is now a favourite, false if it was removed. */
    toggle: (body: z.infer<typeof contracts.favouriteToggleRequest>) =>
      unwrapAs(http.post('/api/favourites', body), contracts.favouriteToggleResponse, 'Could not update favourites.'),
  },

  orders: {
    /**
     * Cash on delivery. Reuse the same idempotencyKey when retrying one
     * attempt: the server then returns the existing order instead of creating
     * a second one.
     */
    createCod: (body: CheckoutRequest, idempotencyKey: string) =>
      unwrapAs(
        http.post('/api/orders', { ...body, paymentMethod: 'cod' }, { headers: { 'X-Idempotency-Key': idempotencyKey } }),
        contracts.codOrderResponse,
        'Could not place the order. Please try again.'
      ),

    // Not schema-checked: one unusual legacy order must not hide the whole list.
    list: () => unwrap<{ orders?: Record<string, unknown>[] }>(http.get('/api/orders'), 'Could not load orders.'),

    razorpayCreateOrder: (body: CheckoutRequest) =>
      unwrapAs(
        http.post('/api/razorpay/create-order', body),
        contracts.razorpayCreateOrderResponse,
        'Could not start the payment. Please try again.'
      ),

    razorpayVerify: (body: z.input<typeof contracts.razorpayVerifyRequest>) =>
      unwrapAs(
        http.post('/api/razorpay/verify-payment', body),
        contracts.razorpayVerifyResponse,
        'Could not confirm the payment.'
      ),
  },

  users: {
    registerPushToken: (body: contracts.PushTokenRequest) =>
      unwrapAs(http.post('/api/users/push-token', body), contracts.pushTokenResponse),
    removePushToken: (body: contracts.PushTokenRequest) =>
      unwrapAs(http.delete('/api/users/push-token', { data: body }), contracts.pushTokenResponse),
    /** Permanently deletes the account. On success, wipe all local data. */
    deleteAccount: (body: contracts.DeleteAccountRequest) =>
      unwrapAs(
        http.delete('/api/users/me', { data: body }),
        contracts.deleteAccountResponse,
        'Could not delete the account. Please try again or contact support.'
      ),
  },
};

/** Wipes local tokens after the account was deleted (no server call needed). */
export async function clearLocalSession() {
  sessionEpoch++;
  await tokenStore.clear();
  await tokenStore.clearPushToken();
}
