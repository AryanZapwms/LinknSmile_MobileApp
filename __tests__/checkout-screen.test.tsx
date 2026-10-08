// The Payment step of app/(customer)/checkout.tsx, rendered against a fake
// backend: no payment method is pre-selected, and the order button does
// nothing until the customer taps one. (With Cash on Delivery pre-selected,
// a single tap used to place a real order.)
// Faked: the network, navigation, the Razorpay sheet, storage, icons.
import { act, configure, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';
import CheckoutScreen from '../app/(customer)/checkout';
import type { AppConfigResponse } from '../contracts';
import { openRazorpayCheckout, razorpayAvailability } from '../services/razorpay';
import { useAppConfigStore } from '../store/app-config.store';
import { useAuthStore } from '../store/auth.store';
import { useCartStore } from '../store/cart.store';
import { json, network, sleep } from '../test-utils/fake-network';

jest.mock('expo-secure-store', () => require('../test-utils/mock-secure-store'));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('crypto').randomUUID() }));
jest.mock('../services/monitoring', () => ({ setMonitoringUser: () => {}, reportError: () => {} }));
jest.mock('../services/notification.service', () => ({ registerForPushNotifications: () => {} }));
jest.mock('../services/razorpay', () => ({
  razorpayAvailability: jest.fn(),
  openRazorpayCheckout: jest.fn(),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
}));

// The first render of a React Native component is slow when Jest's cache is
// cold (always, on CI): give screens time to appear.
configure({ asyncUtilTimeout: 15_000 });
jest.setTimeout(30_000);

const sheet = jest.mocked(openRazorpayCheckout);
const availability = jest.mocked(razorpayAvailability);

// ── Fake backend ─────────────────────────────────────────────────────────────
const PRODUCT = 'a'.repeat(24);

network.handle(({ url, method }) => {
  if (url === '/api/addresses' && method === 'GET') {
    return json(200, [
      { _id: 'addr1', label: 'Home', name: 'Asha', phone: '9876543210', street: '12 MG Road', city: 'Pune', state: 'Maharashtra', pincode: '411001', isDefault: true },
    ]);
  }
  if (url === '/api/pricing/quote') {
    return json(200, {
      success: true,
      currency: 'INR',
      items: [{ product: PRODUCT, name: 'Kurta', quantity: 1, unitPrice: 500, lineTotal: 500, selectedSize: null, shopId: 's1', shopName: 'Shop' }],
      subtotal: 500,
      discountAmount: 0,
      coupon: null,
      taxRatePercent: 0,
      taxAmount: 0,
      shippingAmount: 0,
      totalAmount: 500,
    });
  }
  if (url === '/api/orders' && method === 'POST') {
    return json(200, { success: true, orderId: 'order1', orderNumber: 'ORD-1', message: 'Order created successfully' });
  }
  if (url === '/api/razorpay/create-order') {
    return json(200, { id: 'order_rzp1', amount: 50000, currency: 'INR', totalAmount: 500 });
  }
  if (url === '/api/cart') return json(200, { items: [] });
  return json(404, { error: 'Not found' });
});

const config = (payments: AppConfigResponse['payments']): AppConfigResponse => ({
  minSupportedAppVersion: { ios: '1.0.0', android: '1.0.0' },
  latestAppVersion: null,
  region: 'IN',
  currency: 'INR',
  support: { email: 'support@linknsmile.com', phone: '+91 8355991099' },
  payments,
  links: {
    website: 'https://linknsmile.com',
    privacyPolicy: 'https://linknsmile.com/privacy-policy',
    terms: 'https://linknsmile.com/termsofservice',
    refundPolicy: 'https://linknsmile.com/refund-policy',
  },
});

beforeEach(() => {
  network.clear();
  sheet.mockReset();
  sheet.mockResolvedValue({ status: 'cancelled' }); // the customer closes the sheet without paying
  availability.mockReturnValue('available');
  jest.mocked(router.replace).mockClear();
  useAuthStore.setState({
    user: { id: 'u1', email: 'a@b.co', name: 'Asha', role: 'user', shopId: null },
    sessionRestored: true,
    isLoading: false,
  });
  useAppConfigStore.setState({ config: config({ cod: true, razorpay: true }), updateRequired: false });
  useCartStore.setState({
    items: [{ productId: PRODUCT, name: 'Kurta', price: 500, quantity: 1, image: '', stock: 9, selectedSize: null }],
  });
});

/** Address (saved one is used) → Review (waits for the price) → Payment. */
async function openPaymentStep() {
  render(<CheckoutScreen />);
  fireEvent.press(await screen.findByText('Continue to Review'));
  await waitFor(() => {
    fireEvent.press(screen.getByText('Continue to Payment')); // ignored until the quote has arrived
    expect(screen.getByText('Select payment method')).toBeTruthy();
  });
}

const ordersPlaced = () => network.count('/api/orders', 'POST');
const paymentsStarted = () => network.count('/api/razorpay/create-order', 'POST');

describe('checkout: payment step', () => {
  it('pre-selects nothing: the order button does nothing until a method is tapped', async () => {
    await openPaymentStep();

    // Both methods are offered, and the button asks for a choice instead of offering to order.
    expect(screen.getByText('Cash on Delivery')).toBeTruthy();
    expect(screen.getByText('Pay Online')).toBeTruthy();
    expect(screen.queryByText(/^Place Order/)).toBeNull();
    expect(screen.queryByText(/^Pay · /)).toBeNull();

    fireEvent.press(screen.getByText('Select a payment method'));
    await sleep(100);

    expect(ordersPlaced()).toBe(0);
    expect(paymentsStarted()).toBe(0);
    expect(sheet).not.toHaveBeenCalled();
  });

  it('Cash on Delivery, once tapped, places a COD order and never opens Razorpay', async () => {
    await openPaymentStep();

    fireEvent.press(screen.getByText('Cash on Delivery'));
    fireEvent.press(screen.getByText('Place Order · ₹500'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: 'order1', orderNumber: 'ORD-1' } })
    ));
    expect(ordersPlaced()).toBe(1);
    expect(network.find('/api/orders', 'POST')?.data.paymentMethod).toBe('cod');
    expect(paymentsStarted()).toBe(0);
    expect(sheet).not.toHaveBeenCalled();
  });

  it('Pay Online, once tapped, opens the Razorpay sheet and never places a COD order', async () => {
    await openPaymentStep();

    fireEvent.press(screen.getByText('Pay Online'));
    fireEvent.press(screen.getByText('Pay · ₹500'));

    await waitFor(() => expect(sheet).toHaveBeenCalledTimes(1));
    expect(sheet.mock.calls[0][0]).toMatchObject({ orderId: 'order_rzp1', amount: 50000, currency: 'INR' });
    expect(ordersPlaced()).toBe(0);
  });

  it('does not fall back to the other method when the chosen one is switched off', async () => {
    await openPaymentStep();
    fireEvent.press(screen.getByText('Cash on Delivery'));
    expect(screen.getByText('Place Order · ₹500')).toBeTruthy();

    // The admin turns Cash on Delivery off while the customer is on this step.
    act(() => useAppConfigStore.setState({ config: config({ cod: false, razorpay: true }) }));

    expect(screen.queryByText('Cash on Delivery')).toBeNull();
    fireEvent.press(screen.getByText('Select a payment method'));
    await sleep(100);
    expect(ordersPlaced()).toBe(0);
    expect(paymentsStarted()).toBe(0);
  });

  it('still pre-selects nothing when only one method can be used', async () => {
    availability.mockReturnValue('missing-key'); // this build cannot open Razorpay
    await openPaymentStep();

    expect(screen.getByText('Not available in this version of the app')).toBeTruthy();
    fireEvent.press(screen.getByText('Pay Online')); // disabled: cannot be chosen
    fireEvent.press(screen.getByText('Select a payment method'));
    await sleep(100);

    expect(ordersPlaced()).toBe(0);
    expect(paymentsStarted()).toBe(0);
  });
});
