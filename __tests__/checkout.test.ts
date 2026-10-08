// services/checkout.ts against a fake backend: server pricing, coupons,
// idempotent cash-on-delivery orders, and every way a Razorpay payment can end.
// Real code under test: checkout, api-client, api-error, contracts, cart keys.
// Faked: the network, the Razorpay sheet, secure storage, expo-crypto.
import { apiClient } from '../services/api-client';
import { createAttemptTracker, payWithRazorpay, placeCodOrder, priceCart, toOrderItems } from '../services/checkout';
import { openRazorpayCheckout } from '../services/razorpay';
import { cartItemKey, type CartItem } from '../store/cart.store';
import { json, network, NetworkFailure, tokenResponse } from '../test-utils/fake-network';

jest.mock('expo-secure-store', () => require('../test-utils/mock-secure-store'));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('crypto').randomUUID() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../services/razorpay', () => ({
  razorpayAvailability: () => 'available',
  openRazorpayCheckout: jest.fn(),
}));

// ── The Razorpay sheet: each test says what the customer does in it ──────────
const sheet = jest.mocked(openRazorpayCheckout);
const customer = {
  pays: () =>
    sheet.mockImplementation(async (options) => ({
      status: 'paid',
      razorpayOrderId: options.orderId,
      razorpayPaymentId: `pay_${options.orderId}`,
      razorpaySignature: 'sig',
    })),
  closesTheSheet: () => sheet.mockResolvedValue({ status: 'cancelled' }),
  cardIsDeclined: () => sheet.mockResolvedValue({ status: 'failed', message: 'Card declined' }),
};

// ── Fake backend ─────────────────────────────────────────────────────────────
const KURTA = 'a'.repeat(24);
const SCARF = 'b'.repeat(24);
const UNKNOWN_PRODUCT = 'c'.repeat(24);

class PricingError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

const server = {
  prices: {} as Record<string, number>,
  /** The one-time coupon SAVE10 has been used by an order. */
  couponUsed: false,
  orders: [] as Record<string, any>[],
  /** Razorpay orders created by create-order: id → the total they are for. */
  razorpayOrders: new Map<string, number>(),
  codMode: 'ok' as 'ok' | 'lose-response' | 'out-of-stock',
  verifyMode: 'ok' as 'ok' | 'fail-then-webhook' | 'fail-forever',

  reset() {
    this.prices = { [KURTA]: 500, [SCARF]: 300 };
    this.couponUsed = false;
    this.orders = [];
    this.razorpayOrders.clear();
    this.codMode = 'ok';
    this.verifyMode = 'ok';
  },

  /** POST /api/pricing/quote: SAVE10 takes 10% off the kurta, once per customer. */
  quote(items: { product: string; quantity: number }[], couponCode?: string) {
    let subtotal = 0;
    const lines = items.map((item) => {
      const unitPrice = this.prices[item.product];
      if (unitPrice === undefined) throw new PricingError(404, 'Product not found');
      subtotal += unitPrice * item.quantity;
      return {
        product: item.product,
        name: 'Item',
        quantity: item.quantity,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
        selectedSize: null,
        shopId: 's1',
        shopName: 'Shop',
      };
    });

    let discountAmount = 0;
    let coupon = null;
    if (couponCode) {
      if (couponCode.toUpperCase() !== 'SAVE10') throw new PricingError(400, 'Invalid coupon code');
      if (this.couponUsed) {
        throw new PricingError(400, "You've already used this coupon the maximum number of times");
      }
      if (!items.some((item) => item.product === KURTA)) {
        throw new PricingError(400, "This coupon isn't valid for the items in your cart");
      }
      discountAmount = this.prices[KURTA] * 0.1;
      coupon = { code: 'SAVE10', shopId: 's1', discountAmount };
    }

    return {
      success: true,
      currency: 'INR',
      items: lines,
      subtotal,
      discountAmount,
      coupon,
      taxRatePercent: 0,
      taxAmount: 0,
      shippingAmount: 0,
      totalAmount: subtotal - discountAmount,
    };
  },

  addOrder(fields: Record<string, unknown>) {
    const number = this.orders.length + 1;
    const order = { _id: `order${number}`, orderNumber: `ORD-${number}`, ...fields };
    this.orders.push(order);
    return order;
  },
};

network.handle(({ url, method, data, headers }) => {
  const priced = () => {
    try {
      return server.quote(data.items, data.couponCode);
    } catch (error) {
      if (error instanceof PricingError) return json(error.status, { error: error.message, code: 'PRICING_ERROR' });
      throw error;
    }
  };

  if (url === '/api/mobile-auth/login') {
    // `token` is the pre-Bearer field the login contract still requires.
    return json(200, { ...tokenResponse('access', 'rt_refresh'), token: 'legacy' });
  }

  if (url === '/api/pricing/quote') {
    const quote = priced();
    return 'status' in quote ? quote : json(200, quote);
  }

  if (url === '/api/orders' && method === 'GET') return json(200, { orders: server.orders });

  if (url === '/api/orders' && method === 'POST') {
    const idempotencyKey = headers.get('X-Idempotency-Key');
    const existing = server.orders.find((order) => order.idempotencyKey === idempotencyKey);
    if (existing) {
      return json(200, {
        success: true,
        orderId: existing._id,
        orderNumber: existing.orderNumber,
        message: 'Order already exists',
      });
    }
    if (server.codMode === 'out-of-stock') {
      return json(400, { error: 'Insufficient stock for "Item". Please update your cart.' });
    }
    const quote = priced();
    if ('status' in quote) return quote;
    if (data.couponCode) server.couponUsed = true;
    const order = server.addOrder({ idempotencyKey, totalAmount: quote.totalAmount, paymentMethod: data.paymentMethod });
    if (server.codMode === 'lose-response') {
      // The order exists, but the app never hears about it.
      server.codMode = 'ok';
      return new NetworkFailure('ECONNABORTED', 'timeout of 20000ms exceeded');
    }
    return json(200, {
      success: true,
      orderId: order._id,
      orderNumber: order.orderNumber,
      message: 'Order created successfully',
    });
  }

  if (url === '/api/razorpay/create-order') {
    const quote = priced();
    if ('status' in quote) return quote;
    const id = `order_rzp${server.razorpayOrders.size + 1}`;
    server.razorpayOrders.set(id, quote.totalAmount);
    return json(200, {
      id,
      amount: Math.round(quote.totalAmount * 100),
      currency: 'INR',
      totalAmount: quote.totalAmount,
    });
  }

  if (url === '/api/razorpay/verify-payment') {
    const createOrder = () =>
      server.addOrder({
        razorpayOrderId: data.razorpayOrderId,
        razorpayPaymentId: data.razorpayPaymentId,
        totalAmount: server.razorpayOrders.get(data.razorpayOrderId),
        paymentMethod: 'razorpay',
      });
    if (server.verifyMode === 'ok') return json(200, { success: true, orderId: createOrder()._id });
    // The webhook finishes the order a moment later, independently of this call.
    if (server.verifyMode === 'fail-then-webhook') setTimeout(createOrder, 40);
    return json(500, { error: 'Payment verification failed' });
  }

  return json(404, { error: 'Not found' });
});

// ── Fixtures ─────────────────────────────────────────────────────────────────
const address = {
  name: 'Asha',
  phone: '9876543210',
  street: '12 MG Road',
  city: 'Pune',
  state: 'Maharashtra',
  pincode: '411001',
  country: 'India',
};

const cart: CartItem[] = [
  {
    productId: KURTA,
    name: 'Kurta',
    price: 600,
    discountPrice: 500,
    quantity: 2,
    image: '',
    stock: 9,
    selectedSize: { size: 'M', quantity: 1, unit: 'g' },
  },
  { productId: SCARF, name: 'Scarf', price: 300, quantity: 1, image: '', stock: 9, selectedSize: null },
];
/** 2 × ₹500 + ₹300 = ₹1,300; ₹1,250 with SAVE10. */
const items = toOrderItems(cart);

async function rejection(promise: Promise<unknown>): Promise<any> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected a failure, but the call succeeded');
}

beforeAll(async () => {
  server.reset();
  await apiClient.auth.login({ email: 'a@b.co', password: 'secret1' });
});

beforeEach(() => {
  server.reset();
  network.clear();
  sheet.mockReset();
  customer.pays();
});

describe('cart lines', () => {
  it('become order items with product, quantity and size only: no client prices', () => {
    expect(items).toEqual([
      { product: KURTA, quantity: 2, selectedSize: { size: 'M', quantity: 1 } },
      { product: SCARF, quantity: 1 },
    ]);
  });

  it('have keys that tell sizes of one product apart', () => {
    const large = { ...cart[0], selectedSize: { size: 'L', quantity: 1 } };
    expect(cartItemKey(cart[0])).not.toBe(cartItemKey(large));
    expect(cartItemKey(cart[1])).toBe(`${SCARF}||`);
  });
});

describe('pricing', () => {
  it("uses the server's total and charges no shipping", async () => {
    const priced = await priceCart(items);
    expect(priced.quote).toMatchObject({ totalAmount: 1300, shippingAmount: 0 });
    expect(priced.droppedCoupon).toBeUndefined();
  });

  it('charges ₹300 for a ₹300 cart (the old app added ₹49 shipping under ₹499)', async () => {
    const priced = await priceCart([{ product: SCARF, quantity: 1 }]);
    expect(priced.quote.totalAmount).toBe(300);
  });
});

describe('coupons', () => {
  it('are applied by the quote endpoint', async () => {
    const priced = await priceCart(items, 'SAVE10');
    expect(priced.quote).toMatchObject({ coupon: { code: 'SAVE10' }, discountAmount: 50, totalAmount: 1250 });
  });

  it("are rejected with PRICING_ERROR and the server's message; /api/promos is never called", async () => {
    const error = await rejection(apiClient.pricing.quote({ items, couponCode: 'NOPE' }));
    expect(error).toMatchObject({ code: 'PRICING_ERROR', message: 'Invalid coupon code' });
    expect(network.calls.filter((call) => call.url.startsWith('/api/promos'))).toEqual([]);
  });

  it('are dropped when they no longer fit the cart, which is still priced', async () => {
    const priced = await priceCart([{ product: SCARF, quantity: 1 }], 'SAVE10');
    expect(priced.quote.totalAmount).toBe(300);
    expect(priced.droppedCoupon?.code).toBe('SAVE10');
    expect(priced.droppedCoupon?.reason).toMatch(/isn't valid for the items/);
  });

  it('do not hide an item that cannot be priced at all', async () => {
    const error = await rejection(priceCart([{ product: UNKNOWN_PRODUCT, quantity: 1 }], 'SAVE10'));
    expect(error.code).toBe('PRICING_ERROR');
  });
});

describe('cash on delivery', () => {
  it('places the order with an idempotency key, the stored address shape and no client totals', async () => {
    const tracker = createAttemptTracker();
    const signature = JSON.stringify([items, null, address]);
    const attempt = tracker.attemptFor(signature);

    const outcome = await placeCodOrder({ items, shippingAddress: address, expectedTotal: 1300 }, attempt);

    expect(outcome).toEqual({ kind: 'placed', orderId: 'order1', orderNumber: 'ORD-1' });
    const call = network.find('/api/orders', 'POST')!;
    expect(call.headers.get('X-Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(call.data.shippingAddress).toMatchObject({ street: '12 MG Road', pincode: '411001' });
    expect(call.data.shippingAddress).not.toHaveProperty('addressLine1');
    expect(call.data).not.toHaveProperty('totalAmount');
    expect(call.data).not.toHaveProperty('shippingCost');
    for (const item of call.data.items) expect(item).not.toHaveProperty('price');

    // The same attempt keeps its key; any change to cart, coupon or address gets a new one.
    expect(tracker.attemptFor(signature).key).toBe(attempt.key);
    expect(tracker.attemptFor(`${signature}x`).key).not.toBe(attempt.key);
  });

  it('orders nothing when the price moved after the customer confirmed', async () => {
    server.prices[KURTA] = 550;

    const outcome = await placeCodOrder(
      { items, shippingAddress: address, expectedTotal: 1300 },
      createAttemptTracker().attemptFor('s')
    );

    expect(outcome).toMatchObject({ kind: 'price-changed', quote: { totalAmount: 1400 } });
    expect(network.count('/api/orders', 'POST')).toBe(0);
    expect(server.orders).toEqual([]);
  });

  it('resolves a retry to the same order when the first response was lost', async () => {
    server.codMode = 'lose-response';
    const tracker = createAttemptTracker();
    const request = { items, shippingAddress: address, couponCode: 'SAVE10', expectedTotal: 1250 };

    const error = await rejection(placeCodOrder(request, tracker.attemptFor('attempt')));
    expect(error.isNetworkError).toBe(true);
    // ...but the server did create the order, and used up the one-time coupon.
    expect(server.orders).toHaveLength(1);
    expect(server.couponUsed).toBe(true);

    const retry = await placeCodOrder(request, tracker.attemptFor('attempt'));
    expect(retry).toMatchObject({ kind: 'placed', orderId: 'order1' });
    expect(server.orders).toHaveLength(1);
  });

  it("shows the server's refusal (out of stock) and lets the same attempt be retried", async () => {
    server.codMode = 'out-of-stock';
    const tracker = createAttemptTracker();
    const request = { items, shippingAddress: address, expectedTotal: 1300 };

    const error = await rejection(placeCodOrder(request, tracker.attemptFor('attempt')));
    expect(error.message).toMatch(/Insufficient stock/);

    server.codMode = 'ok';
    const retry = await placeCodOrder(request, tracker.attemptFor('attempt'));
    expect(retry.kind).toBe('placed');
    expect(server.orders).toHaveLength(1);
  });
});

describe('Razorpay', () => {
  const request = { items, shippingAddress: address, expectedTotal: 1300 };

  it('create-order, payment sheet, verify-payment: order placed', async () => {
    const outcome = await payWithRazorpay({
      ...request,
      couponCode: 'SAVE10',
      expectedTotal: 1250,
      prefill: { name: 'Asha', email: 'a@b.co', contact: '9876543210' },
    });

    const create = network.find('/api/razorpay/create-order')!;
    expect(create.data.items).toHaveLength(2);
    expect(create.data.shippingAddress.street).toBe('12 MG Road');
    expect(create.data.couponCode).toBe('SAVE10');
    // The sheet shows the server's order id and its amount in paise.
    expect(sheet.mock.calls[0][0]).toMatchObject({ orderId: 'order_rzp1', amount: 125000, currency: 'INR' });
    expect(network.find('/api/razorpay/verify-payment')!.data).toMatchObject({
      razorpayOrderId: 'order_rzp1',
      razorpayPaymentId: 'pay_order_rzp1',
      razorpaySignature: 'sig',
    });
    expect(outcome).toEqual({ kind: 'placed', orderId: 'order1' });
  });

  it.each([
    ['cancelled', customer.closesTheSheet],
    ['failed', customer.cardIsDeclined],
  ] as const)('%s in the sheet: nothing is verified and no order exists', async (kind, customerAction) => {
    customerAction();

    const outcome = await payWithRazorpay(request);

    expect(outcome.kind).toBe(kind);
    expect(network.count('/api/razorpay/verify-payment')).toBe(0);
    expect(server.orders).toEqual([]);
  });

  it('never opens the sheet when the price changed at create-order', async () => {
    server.prices[SCARF] = 350;

    const outcome = await payWithRazorpay(request);

    expect(outcome.kind).toBe('price-changed');
    expect(sheet).not.toHaveBeenCalled();
  });

  it("finds the webhook's order when the customer paid but verify-payment failed", async () => {
    server.verifyMode = 'fail-then-webhook';

    const outcome = await payWithRazorpay(request, { pollIntervalMs: 30 });

    expect(outcome).toEqual({ kind: 'placed', orderId: 'order1' });
    expect(network.count('/api/razorpay/verify-payment')).toBe(1); // not retried
  });

  it('reports "pending", never "failed", when the customer paid and no order shows up yet', async () => {
    server.verifyMode = 'fail-forever';

    const outcome = await payWithRazorpay(request, { pollIntervalMs: 5 });

    expect(outcome).toMatchObject({ kind: 'pending', paymentId: 'pay_order_rzp1' });
    expect(network.count('/api/orders', 'GET')).toBe(6); // a bounded number of checks, then stop
    expect(sheet).toHaveBeenCalledTimes(1); // the customer was not asked to pay twice
  });
});
