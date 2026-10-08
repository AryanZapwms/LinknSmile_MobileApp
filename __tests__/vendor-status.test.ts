// store/vendor-status.store.ts and the vendor endpoints of the API client,
// against a fake backend: loading the seller's status, accepting the
// agreement, and reacting when the server refuses a request with a gate code.
import { apiClient, http } from '../services/api-client';
import { vendorBlock } from '../services/vendor-access';
import { useVendorStatusStore } from '../store/vendor-status.store';
import { json, network, NetworkFailure, sleep, tokenResponse } from '../test-utils/fake-network';

jest.mock('expo-secure-store', () => require('../test-utils/mock-secure-store'));

/** The fake backend's view of the seller. */
const server = {
  mouAccepted: true,
  subscriptionBlocked: false,
  isApproved: true,
  hasShop: true,
  offline: false,

  reset() {
    Object.assign(this, { mouAccepted: true, subscriptionBlocked: false, isApproved: true, hasShop: true, offline: false });
  },
  /** lib/vendor-guard.ts: the first gate that blocks a selling request. */
  sellingBlock() {
    if (!this.mouAccepted) return 'MOU_REQUIRED';
    if (this.subscriptionBlocked) return 'SUBSCRIPTION_EXPIRED';
    if (!this.isApproved) return 'SHOP_PENDING';
    return null;
  },
  status() {
    return {
      success: true,
      isApproved: this.isApproved,
      isActive: true,
      mouAccepted: this.mouAccepted,
      mouVersion: '1.0.0',
      blockingCode: !this.mouAccepted ? 'MOU_REQUIRED' : this.subscriptionBlocked ? 'SUBSCRIPTION_EXPIRED' : null,
      subscription: {
        status: this.subscriptionBlocked ? 'blocked' : 'active',
        expiryDate: '2027-03-05T12:00:00.000Z',
        daysUntilExpiry: this.subscriptionBlocked ? -12 : 120,
        isInGracePeriod: false,
        isBlocked: this.subscriptionBlocked,
        source: 'paid',
      },
    };
  },
};

const ACCEPTED_AT = '2026-10-06T07:00:00.000Z';

network.handle(async ({ url, method }) => {
  if (url === '/api/mobile-auth/login') return json(200, { ...tokenResponse('access', 'rt_refresh'), token: 'legacy' });
  if (server.offline) return new NetworkFailure();

  if (url === '/api/vendor/status') {
    await sleep(20);
    if (!server.hasShop) return json(404, { success: false, isApproved: false, message: 'Shop not found' });
    return json(200, server.status());
  }

  if (url === '/api/vendor/mou' && method === 'GET') {
    return json(200, {
      success: true,
      version: '1.0.0',
      content: '# Vendor Memorandum of Understanding',
      accepted: server.mouAccepted,
      acceptedAt: server.mouAccepted ? ACCEPTED_AT : null,
    });
  }
  if (url === '/api/vendor/mou' && method === 'POST') {
    server.mouAccepted = true;
    return json(200, { success: true, accepted: true, acceptedAt: ACCEPTED_AT });
  }

  if (url === '/api/vendor/orders') {
    const code = server.sellingBlock();
    if (code) return json(403, { error: 'Blocked', message: 'Blocked', code });
    return json(200, { success: true, orders: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } });
  }
  if (url === '/api/admin/only') return json(403, { error: 'Forbidden', code: 'FORBIDDEN' });

  return json(404, { error: 'Not found' });
});

const store = () => useVendorStatusStore.getState();
const statusRequests = () => network.count('/api/vendor/status');

beforeAll(() => apiClient.auth.login({ email: 'seller@shop.co', password: 'secret1' }));

beforeEach(() => {
  server.reset();
  store().reset();
  network.clear();
});

describe('loading the status', () => {
  it('stores what GET /api/vendor/status reports', async () => {
    await store().load();
    expect(store()).toMatchObject({ loading: false, error: null, status: { mouAccepted: true, blockingCode: null } });
  });

  it('shares one request between calls made at the same time', async () => {
    await Promise.all([store().load(), store().load(), store().load()]);
    expect(statusRequests()).toBe(1);
  });

  it('keeps the last known status when a later load fails', async () => {
    await store().load();
    server.offline = true;

    await store().load();

    expect(store().status).not.toBeNull();
    expect(store().error).toMatchObject({ isNetworkError: true });
  });

  it('reports a seller without a shop as a 404, with no status', async () => {
    server.hasShop = false;
    await store().load();
    expect(store().status).toBeNull();
    expect(store().error).toMatchObject({ status: 404, message: 'Shop not found' });
  });

  it("does not let a request from before sign-out write into the next seller's session", async () => {
    const pending = store().load();
    store().reset(); // signed out while the request was in the air
    await pending;
    expect(store().status).toBeNull();
    expect(store().loading).toBe(false);
  });
});

describe('the vendor agreement', () => {
  it('blocks the whole seller area until accepted, then opens it', async () => {
    server.mouAccepted = false;
    await store().load();
    expect(vendorBlock(store().status!, 'account')).toBe('MOU_REQUIRED');

    const mou = await apiClient.vendor.mou();
    expect(mou).toMatchObject({ version: '1.0.0', accepted: false, acceptedAt: null });

    const accepted = await apiClient.vendor.acceptMou();
    expect(accepted).toMatchObject({ accepted: true, acceptedAt: ACCEPTED_AT });
    expect(network.find('/api/vendor/mou', 'POST')).toBeDefined();

    await store().load();
    expect(vendorBlock(store().status!, 'account')).toBeNull();
    expect(vendorBlock(store().status!, 'selling')).toBeNull();
  });
});

describe('a request refused with a gate code', () => {
  it.each([
    ['MOU_REQUIRED', () => { server.mouAccepted = false; }],
    ['SUBSCRIPTION_EXPIRED', () => { server.subscriptionBlocked = true; }],
    ['SHOP_PENDING', () => { server.isApproved = false; }],
  ] as const)('%s: the status is asked for again and the screens follow it', async (code, change) => {
    await store().load();
    expect(vendorBlock(store().status!, 'selling')).toBeNull();

    change(); // it changes on the server while the app is open
    const error = await http.get('/api/vendor/orders').catch((e) => e);
    expect(error.response.data.code).toBe(code); // the caller still gets its error

    await sleep(60); // the reload runs in the background
    expect(statusRequests()).toBe(2);
    expect(vendorBlock(store().status!, 'selling')).toBe(code);
  });

  it('asks only once when several requests are refused together', async () => {
    await store().load();
    server.subscriptionBlocked = true;

    await Promise.all([1, 2, 3].map(() => http.get('/api/vendor/orders').catch(() => {})));
    await sleep(60);

    expect(statusRequests()).toBe(2);
  });

  it('ignores a 403 that is not a seller gate', async () => {
    await store().load();
    await http.get('/api/admin/only').catch(() => {});
    await sleep(60);
    expect(statusRequests()).toBe(1);
  });
});
