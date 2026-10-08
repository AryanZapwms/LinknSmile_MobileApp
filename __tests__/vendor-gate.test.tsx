// What a seller actually sees: app/(vendor)/_layout.tsx and the selling-screen
// gate, rendered against a fake backend.
// - MOU_REQUIRED: only the agreement, until it is accepted.
// - SUBSCRIPTION_EXPIRED / shop not approved: the seller area opens, but the
//   selling screens are locked and are not even mounted.
// Faked: the network, navigation (the tab navigator is a marker), storage, icons.
import { act, configure, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
import VendorLayout from '../app/(vendor)/_layout';
import { withSellingGate } from '../components/vendor/SellingGate';
import { http } from '../services/api-client';
import { useAuthStore } from '../store/auth.store';
import { useVendorStatusStore } from '../store/vendor-status.store';
import { json, network, NetworkFailure } from '../test-utils/fake-network';

jest.mock('expo-secure-store', () => require('../test-utils/mock-secure-store'));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
}));
jest.mock('../services/monitoring', () => ({ setMonitoringUser: () => {}, reportError: () => {} }));
jest.mock('../services/notification.service', () => ({ registerForPushNotifications: () => {} }));
// The real tab navigator would mount every seller screen; a marker is enough
// to tell "the seller area is shown" from "the gate is shown".
jest.mock('expo-router', () => {
  const { Text: MockText } = require('react-native');
  function Tabs() {
    return <MockText>SELLER AREA</MockText>;
  }
  Tabs.Screen = function Screen() {
    return null;
  };
  return { Tabs, router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() } };
});

// The first render of a React Native component is slow when Jest's cache is
// cold (always, on CI): give screens time to appear.
configure({ asyncUtilTimeout: 15_000 });
jest.setTimeout(30_000);

// ── Fake backend ─────────────────────────────────────────────────────────────
const server = {
  mouAccepted: true,
  subscriptionBlocked: false,
  isApproved: true,
  hasShop: true,
  offline: false,
  reset() {
    Object.assign(this, { mouAccepted: true, subscriptionBlocked: false, isApproved: true, hasShop: true, offline: false });
  },
};

const AGREEMENT = '# Vendor Memorandum of Understanding\n\nThe Vendor shall pay an annual fee.';

network.handle(({ url, method }) => {
  if (server.offline) return new NetworkFailure();

  if (url === '/api/vendor/status') {
    if (!server.hasShop) return json(404, { success: false, isApproved: false, message: 'Shop not found' });
    return json(200, {
      success: true,
      isApproved: server.isApproved,
      isActive: true,
      mouAccepted: server.mouAccepted,
      mouVersion: '1.0.0',
      blockingCode: !server.mouAccepted ? 'MOU_REQUIRED' : server.subscriptionBlocked ? 'SUBSCRIPTION_EXPIRED' : null,
      subscription: {
        status: server.subscriptionBlocked ? 'blocked' : 'active',
        expiryDate: '2027-03-05T12:00:00.000Z',
        daysUntilExpiry: server.subscriptionBlocked ? -12 : 120,
        isInGracePeriod: false,
        isBlocked: server.subscriptionBlocked,
        source: 'paid',
      },
    });
  }

  if (url === '/api/vendor/mou' && method === 'GET') {
    return json(200, {
      success: true,
      version: '1.0.0',
      content: AGREEMENT,
      accepted: server.mouAccepted,
      acceptedAt: server.mouAccepted ? '2026-10-06T07:00:00.000Z' : null,
    });
  }
  if (url === '/api/vendor/mou' && method === 'POST') {
    server.mouAccepted = true;
    return json(200, { success: true, accepted: true, acceptedAt: '2026-10-06T07:00:00.000Z' });
  }

  if (url === '/api/vendor/wallet') {
    if (!server.mouAccepted) {
      return json(403, { error: 'Accept the agreement', message: 'Accept the agreement', code: 'MOU_REQUIRED', mouVersion: '2.0.0' });
    }
    return json(200, {});
  }

  return json(404, { error: 'Not found' });
});

const SELLER = { id: 'v1', email: 'seller@shop.co', name: 'Asha', role: 'shop_owner' as const, shopId: 's1' };

beforeEach(() => {
  server.reset();
  network.clear();
  useVendorStatusStore.getState().reset();
  useAuthStore.setState({ user: SELLER, sessionRestored: true, isLoading: false });
  jest.mocked(router.push).mockClear();
});

const sellerArea = () => screen.queryByText('SELLER AREA');
/** Asks the server for the seller's status, as the layout does. */
const loadStatus = () => act(() => useVendorStatusStore.getState().load());

describe('seller area layout', () => {
  it('opens the seller area for a seller with nothing in the way', async () => {
    render(<VendorLayout />);
    expect(sellerArea()).toBeNull(); // nothing is shown before the server has answered
    await waitFor(() => expect(sellerArea()).not.toBeNull());
  });

  it('MOU_REQUIRED: shows only the agreement; accepting it opens the seller area', async () => {
    server.mouAccepted = false;
    render(<VendorLayout />);

    // The agreement text itself is on screen, and the seller area is not.
    await screen.findByText('The Vendor shall pay an annual fee.');
    expect(sellerArea()).toBeNull();

    // "I Agree" does nothing until the box is ticked.
    fireEvent.press(screen.getByText('I Agree'));
    expect(network.count('/api/vendor/mou', 'POST')).toBe(0);

    fireEvent.press(screen.getByRole('checkbox'));
    fireEvent.press(screen.getByText('I Agree'));

    await waitFor(() => expect(sellerArea()).not.toBeNull());
    expect(network.count('/api/vendor/mou', 'POST')).toBe(1);
  });

  it('MOU_REQUIRED: offers sign-out and account deletion, so the seller is never trapped', async () => {
    server.mouAccepted = false;
    render(<VendorLayout />);

    await screen.findByText('Sign out');
    fireEvent.press(screen.getByText('Delete my account'));

    await screen.findByText('This permanently deletes your account');
  });

  it('a new agreement version while the app is open brings the gate back', async () => {
    render(<VendorLayout />);
    await waitFor(() => expect(sellerArea()).not.toBeNull());

    server.mouAccepted = false; // the agreement was re-issued on the server
    // Any seller request is now refused with MOU_REQUIRED.
    await act(() => http.get('/api/vendor/wallet').then(() => {}, () => {}));

    await screen.findByText('I Agree');
    expect(sellerArea()).toBeNull();
  });

  it.each([
    ['an expired subscription', () => { server.subscriptionBlocked = true; }],
    ['a shop awaiting approval', () => { server.isApproved = false; }],
  ])('%s does not close the seller area (wallet and payouts stay reachable)', async (_case, arrange) => {
    arrange();
    render(<VendorLayout />);
    await waitFor(() => expect(sellerArea()).not.toBeNull());
  });

  it('shows a retry screen, not the seller area, when the status cannot be loaded', async () => {
    server.offline = true;
    render(<VendorLayout />);

    await screen.findByText("Couldn't load your seller account");
    expect(sellerArea()).toBeNull();

    server.offline = false;
    fireEvent.press(screen.getByText('Try again'));
    await waitFor(() => expect(sellerArea()).not.toBeNull());
  });

  it('explains when the account has no shop', async () => {
    server.hasShop = false;
    render(<VendorLayout />);
    await screen.findByText('No shop on this account');
    expect(sellerArea()).toBeNull();
  });
});

describe('selling screens (orders, products)', () => {
  const mounted = jest.fn();
  function OrdersScreen() {
    mounted(); // the real screen would start requesting /api/vendor/orders here
    return <Text>ORDER LIST</Text>;
  }
  const GatedOrders = withSellingGate(OrdersScreen, 'Orders');

  beforeEach(() => mounted.mockClear());

  it('are shown when selling is open', async () => {
    await loadStatus();
    render(<GatedOrders />);
    expect(screen.getByText('ORDER LIST')).toBeTruthy();
  });

  it('SUBSCRIPTION_EXPIRED: locked and not mounted; the wallet is one tap away; no way to pay is offered', async () => {
    server.subscriptionBlocked = true;
    await loadStatus();
    render(<GatedOrders />);

    expect(screen.getByText('Selling is paused')).toBeTruthy();
    expect(screen.queryByText('ORDER LIST')).toBeNull();
    expect(mounted).not.toHaveBeenCalled();
    expect(screen.queryByText(/renew|pay now|subscribe|purchase/i)).toBeNull();

    fireEvent.press(screen.getByText('Open wallet'));
    expect(router.push).toHaveBeenCalledWith('/(vendor)/wallet');
    fireEvent.press(screen.getByText('View account status'));
    expect(router.push).toHaveBeenCalledWith('/(vendor)/status');
  });

  it('shop not approved: shows "awaiting approval" instead of the screen', async () => {
    server.isApproved = false;
    await loadStatus();
    render(<GatedOrders />);

    expect(screen.getByText('Awaiting approval')).toBeTruthy();
    expect(mounted).not.toHaveBeenCalled();
  });

  it('unlock as soon as the status says selling is open again', async () => {
    server.subscriptionBlocked = true;
    await loadStatus();
    render(<GatedOrders />);
    expect(screen.queryByText('ORDER LIST')).toBeNull();

    server.subscriptionBlocked = false;
    await loadStatus();
    expect(screen.getByText('ORDER LIST')).toBeTruthy();
  });
});
