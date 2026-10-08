// services/api-client.ts against a fake backend: Bearer auth, the
// refresh-once / retry-once rule, forced logout, and the typed endpoints.
// Real code under test: api-client, token-store, api-error, contracts.
// Faked: expo-secure-store and the network.
import { ApiError } from '../services/api-error';
import { apiClient, http, setSessionListener } from '../services/api-client';
import { tokenStore } from '../services/token-store';
import { json, network, NetworkFailure, sleep, tokenResponse, TEST_USER } from '../test-utils/fake-network';
import { secureStoreData } from '../test-utils/mock-secure-store';

jest.mock('expo-secure-store', () => require('../test-utils/mock-secure-store'));

const SESSION_KEY = 'lns_session_v1';

type RefreshMode = 'ok' | 'slow-ok' | 'invalid' | 'network' | 'server-error' | 'rotated-with-newer';

/** The fake backend's state: which tokens are currently valid, and how it should misbehave. */
const server = {
  access: '',
  refresh: '',
  issued: 0,
  refreshMode: 'ok' as RefreshMode,
  loginMode: 'ok' as 'ok' | 'rate-limited',

  issue() {
    this.issued++;
    this.access = `access-${this.issued}`;
    this.refresh = `rt_refresh-${this.issued}`;
    return tokenResponse(this.access, this.refresh);
  },
  /** Makes the app's access token stale, as if 15 minutes had passed. */
  expireAccessToken() {
    this.access = `access-expired-${++this.issued}`;
  },
};

network.handle(async ({ url, method, auth, data }) => {
  const signedIn = auth === `Bearer ${server.access}`;

  if (url === '/api/mobile-auth/login') {
    if (server.loginMode === 'rate-limited') {
      return json(
        429,
        { error: 'Too many login attempts. Please try again later.', code: 'RATE_LIMITED' },
        { 'retry-after': '60' }
      );
    }
    // `token` is the pre-Bearer field the server still sends; the app must ignore it.
    return json(200, { ...server.issue(), token: 'legacy' });
  }

  if (url === '/api/mobile-auth/refresh') {
    switch (server.refreshMode) {
      case 'network':
        return new NetworkFailure();
      case 'server-error':
        return json(500, { error: 'Could not refresh session. Please retry.', code: 'INTERNAL_ERROR' });
      case 'invalid':
        return json(401, { error: 'Session expired. Please log in again.', code: 'REFRESH_TOKEN_INVALID' });
      case 'rotated-with-newer':
        // "Something else already used this refresh token and stored newer tokens."
        secureStoreData.set(SESSION_KEY, JSON.stringify(server.issue()));
        return json(401, { error: 'Token already rotated', code: 'REFRESH_TOKEN_ROTATED' });
      case 'slow-ok':
        await sleep(80);
      // falls through
      default:
        if (data?.refreshToken !== server.refresh) {
          return json(401, { error: 'Session expired.', code: 'REFRESH_TOKEN_INVALID' });
        }
        return json(200, server.issue());
    }
  }

  if (url === '/api/mobile-auth/logout') return json(200, { success: true });
  if (url === '/api/always-401') return json(401, { error: 'Unauthorized' });
  if (url === '/api/wrong-password') {
    return json(401, { error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
  }

  if (url === '/api/orders' && method === 'POST') {
    if (!signedIn) return json(401, { error: 'Unauthorized. Please log in.' });
    return json(200, { success: true, orderId: 'o1', orderNumber: 'ORD-1', message: 'Order created successfully' });
  }
  if (url === '/api/users/me' && method === 'DELETE') {
    if (!signedIn) return json(401, { error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return json(409, { error: 'You have orders that are still in progress.', code: 'OPEN_ORDERS', openOrders: 2 });
  }

  // Any other URL is a protected resource. Older routes answer 401 without a code.
  if (!signedIn) {
    return json(401, url === '/api/new-style' ? { error: 'Unauthorized', code: 'UNAUTHORIZED' } : { error: 'Unauthorized' });
  }
  return json(200, { ok: true, url });
});

/** What the auth store would have been told. */
const events: string[] = [];
setSessionListener({
  onSessionUpdated: () => events.push('updated'),
  onSessionEnded: (reason) => events.push(`ended:${reason}`),
});

const REFRESH = '/api/mobile-auth/refresh';

/** Resolves to the error a promise rejects with (fails the test if it resolves). */
async function rejection(promise: Promise<unknown>): Promise<any> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the request to fail, but it succeeded');
}

/** Starts every test signed in, with a clean request log. */
async function signIn() {
  await apiClient.auth.logout();
  server.refreshMode = 'ok';
  server.loginMode = 'ok';
  await apiClient.auth.login({ email: 'a@b.co', password: 'secret1' });
  network.clear();
  events.length = 0;
}

beforeEach(signIn);

describe('login', () => {
  it('stores both tokens and the user as one secure-storage record', async () => {
    const stored = await tokenStore.load();
    expect(stored).toMatchObject({
      accessToken: server.access,
      refreshToken: server.refresh,
      user: { id: TEST_USER.id },
    });
    expect(stored).not.toHaveProperty('token'); // the legacy field is not kept
    expect([...secureStoreData.keys()]).toEqual([SESSION_KEY]);
  });

  it('sends later requests with Authorization: Bearer <accessToken>', async () => {
    const response = await http.get('/api/thing');
    expect(response.data.ok).toBe(true);
    expect(network.calls[0].auth).toBe(`Bearer ${server.access}`);
  });

  it('is never retried, and reports the rate limit with its Retry-After', async () => {
    await apiClient.auth.logout();
    network.clear();
    server.loginMode = 'rate-limited';

    const error = await rejection(apiClient.auth.login({ email: 'a@b.co', password: 'x' }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 60 });
    expect(network.count('/api/mobile-auth/login')).toBe(1);
    expect(await tokenStore.load()).toBeNull();
  });
});

describe('expired access token', () => {
  it('refreshes once and retries the request once', async () => {
    const oldRefreshToken = server.refresh;
    server.expireAccessToken();

    const response = await http.get('/api/thing');

    expect(response.data.ok).toBe(true);
    expect(network.count(REFRESH)).toBe(1);
    expect(network.count('/api/thing')).toBe(2); // first try + the one retry
    const stored = await tokenStore.load();
    expect(stored).toMatchObject({ accessToken: server.access, refreshToken: server.refresh });
    expect(stored?.refreshToken).not.toBe(oldRefreshToken); // the refresh token was rotated
    expect(events).toEqual(['updated']);
  });

  it('refreshes exactly once when five requests fail together (single-flight)', async () => {
    server.expireAccessToken();
    server.refreshMode = 'slow-ok';

    const responses = await Promise.all([1, 2, 3, 4, 5].map((i) => http.get(`/api/thing-${i}`)));

    expect(responses.map((r) => r.data.ok)).toEqual([true, true, true, true, true]);
    expect(network.count(REFRESH)).toBe(1);

    // A later request already has the new token: no further refresh.
    await http.get('/api/thing-late');
    expect(network.count(REFRESH)).toBe(1);
    expect(network.count('/api/thing-late')).toBe(1);
  });

  it('treats a 401 with code UNAUTHORIZED the same way (newer routes)', async () => {
    server.expireAccessToken();
    const response = await http.get('/api/new-style');
    expect(response.data.ok).toBe(true);
    expect(network.count(REFRESH)).toBe(1);
  });

  it('uses newer stored tokens on REFRESH_TOKEN_ROTATED instead of refreshing again', async () => {
    server.expireAccessToken();
    server.refreshMode = 'rotated-with-newer';

    const response = await http.get('/api/thing');

    expect(response.data.ok).toBe(true);
    expect(network.count(REFRESH)).toBe(1);
    expect(events.filter((e) => e.startsWith('ended'))).toEqual([]);
  });
});

describe('refresh rejected by the server', () => {
  it('ends the session: tokens wiped, listener told, no retry and no loop', async () => {
    server.expireAccessToken();
    server.refreshMode = 'invalid';

    const error = await rejection(http.get('/api/thing'));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(network.count(REFRESH)).toBe(1);
    expect(network.count('/api/thing')).toBe(1); // the original was NOT retried
    expect(await tokenStore.load()).toBeNull();
    expect(secureStoreData.has(SESSION_KEY)).toBe(false);
    expect(events).toEqual(['ended:REFRESH_TOKEN_INVALID']);

    // Now signed out: the next request goes without a token and its 401 just surfaces.
    await rejection(http.get('/api/thing'));
    expect(network.count(REFRESH)).toBe(1);
    expect(network.calls.at(-1)?.auth).toBeUndefined();
  });
});

describe('no retry loops', () => {
  it('stops after one retry when an endpoint still answers 401 after a good refresh', async () => {
    const error = await rejection(http.get('/api/always-401'));

    expect(error.response?.status).toBe(401);
    expect(network.count(REFRESH)).toBe(1);
    expect(network.count('/api/always-401')).toBe(2);
    // The refresh itself succeeded, so the user stays signed in.
    expect(await tokenStore.load()).not.toBeNull();
    expect(events.filter((e) => e.startsWith('ended'))).toEqual([]);
  });

  it('does not refresh on a 401 that is not about the token (INVALID_CREDENTIALS)', async () => {
    await rejection(http.post('/api/wrong-password', {}));
    expect(network.count(REFRESH)).toBe(0);
    expect(network.count('/api/wrong-password')).toBe(1);
  });

  it('does not refresh when a signed-out request gets a 401', async () => {
    await apiClient.auth.logout();
    network.clear();
    events.length = 0;

    await rejection(http.get('/api/thing'));

    expect(network.count(REFRESH)).toBe(0);
    expect(events).toEqual([]);
  });
});

describe('refresh cannot reach the server', () => {
  it.each(['network', 'server-error'] as const)('%s: the user stays signed in', async (mode) => {
    server.expireAccessToken();
    server.refreshMode = mode;

    const error = await rejection(http.get('/api/thing'));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.isNetworkError).toBe(true);
    expect(network.count(REFRESH)).toBe(1);
    expect(network.count('/api/thing')).toBe(1); // not retried
    expect(await tokenStore.load()).not.toBeNull();
    expect(events).toEqual([]);
  });
});

describe('logout', () => {
  it('revokes the refresh token and push token on the server, then wipes local data', async () => {
    await tokenStore.setPushToken('ExponentPushToken[abc]');
    const before = await tokenStore.load();

    await apiClient.auth.logout();

    const call = network.find('/api/mobile-auth/logout');
    expect(call?.data).toEqual({ refreshToken: before?.refreshToken, pushToken: 'ExponentPushToken[abc]' });
    expect(call?.auth).toBe(`Bearer ${before?.accessToken}`);
    expect(await tokenStore.load()).toBeNull();
    expect(await tokenStore.getPushToken()).toBeNull();
  });

  it('wins over a refresh that is still in the air: its tokens are not written back', async () => {
    server.expireAccessToken();
    server.refreshMode = 'slow-ok';

    const pending = rejection(http.get('/api/thing'));
    await sleep(30); // the refresh request is now on its way
    await apiClient.auth.logout();
    await pending; // rejects: the session ended underneath it

    expect(await tokenStore.load()).toBeNull();
    expect(secureStoreData.has(SESSION_KEY)).toBe(false);
  });
});

describe('typed endpoints', () => {
  it('COD order: sends X-Idempotency-Key and paymentMethod "cod", returns { orderId, orderNumber }', async () => {
    const order = await apiClient.orders.createCod(
      {
        items: [{ product: 'a'.repeat(24), quantity: 1 }],
        shippingAddress: { name: 'A', phone: '9999999999', street: '1 St', city: 'Mumbai', state: 'MH', pincode: '400001' },
      },
      'idem-123'
    );

    expect(order).toMatchObject({ orderId: 'o1', orderNumber: 'ORD-1' });
    const call = network.find('/api/orders', 'POST');
    expect(call?.headers.get('X-Idempotency-Key')).toBe('idem-123');
    expect(call?.data.paymentMethod).toBe('cod');
  });

  it('account deletion: sends a JSON body with DELETE, surfaces OPEN_ORDERS and its count', async () => {
    const error = await rejection(apiClient.users.deleteAccount({ confirm: 'DELETE', password: 'secret1' }));

    expect(network.find('/api/users/me', 'DELETE')?.data).toEqual({ confirm: 'DELETE', password: 'secret1' });
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'OPEN_ORDERS', data: { openOrders: 2 } });
  });
});
