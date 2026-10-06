// services/checkout.ts
// Checkout logic, kept out of the screen so it can be tested on its own.
//
// Rules this file enforces (docs/mobile-api.md):
// - Prices only ever come from the server: POST /api/pricing/quote.
//   `quote.totalAmount` is what an order will charge; there is no shipping fee.
// - The amount the customer confirmed is checked again at the last moment. If
//   the server's price moved in between, nothing is ordered or charged and the
//   screen shows the new total for confirmation.
// - Cash on delivery sends an X-Idempotency-Key, the same one for every retry
//   of one attempt, so a lost response can never create a second order.
// - Once Razorpay says "paid", the customer has been charged: from then on the
//   result is either an order or "we are confirming your payment", never a
//   plain failure that invites paying again.

import * as Crypto from 'expo-crypto';
import type { CartItemInputDto, QuoteResponse } from '../contracts';
import type { CartItem } from '../store/cart.store';
import { apiClient, type ShippingAddressInput } from './api-client';
import { toApiError } from './api-error';
import { openRazorpayCheckout } from './razorpay';

/** Cart lines → the `items` shape every pricing/order endpoint takes. */
export function toOrderItems(items: CartItem[]): CartItemInputDto[] {
  return items.map((item) => ({
    product: item.productId,
    quantity: item.quantity,
    ...(item.selectedSize
      ? { selectedSize: { size: item.selectedSize.size, quantity: item.selectedSize.quantity } }
      : {}),
  }));
}

/** Compares two amounts to the paisa. */
export const sameAmount = (a: number, b: number) => Math.round(a * 100) === Math.round(b * 100);

// ── Pricing ──────────────────────────────────────────────────────────────────

export interface PricedCart {
  quote: QuoteResponse;
  /** Set when the coupon stopped being valid for these items and was left out. */
  droppedCoupon?: { code: string; reason: string };
}

/**
 * Prices the selected items, with the coupon if one is applied. If the coupon
 * no longer fits (e.g. its shop's item was deselected) the cart is priced
 * once more without it, so the customer still sees a total.
 */
export async function priceCart(items: CartItemInputDto[], couponCode?: string | null): Promise<PricedCart> {
  if (!couponCode) return { quote: await apiClient.pricing.quote({ items }) };
  try {
    return { quote: await apiClient.pricing.quote({ items, couponCode }) };
  } catch (error) {
    const apiError = toApiError(error);
    if (apiError.code !== 'PRICING_ERROR') throw apiError;
    try {
      const quote = await apiClient.pricing.quote({ items });
      return { quote, droppedCoupon: { code: couponCode, reason: apiError.message } };
    } catch {
      // Still can't be priced without the coupon: the problem is an item.
      throw apiError;
    }
  }
}

// ── Idempotency ──────────────────────────────────────────────────────────────

export interface CheckoutAttempt {
  key: string;
  /** True once an order request with this key has been sent. */
  sent: boolean;
}

/**
 * One idempotency key per checkout attempt. The same cart, coupon and address
 * (`signature`) keep their key across retries; any change starts a new attempt.
 */
export function createAttemptTracker() {
  let current: (CheckoutAttempt & { signature: string }) | null = null;
  return {
    attemptFor(signature: string): CheckoutAttempt {
      if (current?.signature !== signature) {
        current = { signature, key: Crypto.randomUUID(), sent: false };
      }
      return current;
    },
    reset() {
      current = null;
    },
  };
}

// ── Cash on delivery ─────────────────────────────────────────────────────────

export interface OrderRequest {
  items: CartItemInputDto[];
  shippingAddress: ShippingAddressInput;
  couponCode?: string | null;
  /** The total the customer saw and confirmed (quote.totalAmount). */
  expectedTotal: number;
}

export type CodOutcome =
  | { kind: 'placed'; orderId: string; orderNumber?: string }
  | { kind: 'price-changed'; quote: QuoteResponse };

async function findOrderByIdempotencyKey(key: string): Promise<{ orderId: string; orderNumber?: string } | null> {
  const { orders = [] } = await apiClient.orders.list();
  const match = orders.find((order) => order.idempotencyKey === key);
  return match ? { orderId: String(match._id), orderNumber: match.orderNumber as string | undefined } : null;
}

export async function placeCodOrder(request: OrderRequest, attempt: CheckoutAttempt): Promise<CodOutcome> {
  const couponCode = request.couponCode || undefined;

  // Retrying an attempt whose first request may have reached the server: if
  // it did, that order is the answer. (Re-pricing first could wrongly fail
  // here, e.g. because the first order already used up a one-time coupon.)
  if (attempt.sent) {
    const existing = await findOrderByIdempotencyKey(attempt.key).catch(() => null);
    if (existing) return { kind: 'placed', ...existing };
  }

  const quote = await apiClient.pricing.quote({ items: request.items, couponCode });
  if (!sameAmount(quote.totalAmount, request.expectedTotal)) {
    return { kind: 'price-changed', quote };
  }

  attempt.sent = true;
  const order = await apiClient.orders.createCod(
    { items: request.items, shippingAddress: request.shippingAddress, couponCode },
    attempt.key
  );
  return { kind: 'placed', orderId: order.orderId, orderNumber: order.orderNumber };
}

// ── Razorpay ─────────────────────────────────────────────────────────────────

export type OnlineOutcome =
  | { kind: 'placed'; orderId: string }
  /** The server's price differs from what was shown. Nothing was charged. */
  | { kind: 'price-changed' }
  /** The customer closed the Razorpay sheet. Nothing was charged. */
  | { kind: 'cancelled' }
  /** Razorpay reported a failure. Nothing was charged. */
  | { kind: 'failed'; message: string }
  /**
   * Charged, but the order isn't confirmed yet; the server's webhook will
   * finish it. `serverMessage` is what the server said, if it answered at all.
   */
  | { kind: 'pending'; paymentId: string; serverMessage?: string };

const ORDER_POLL_ATTEMPTS = 6;
const ORDER_POLL_INTERVAL_MS = 4000;

/** Looks for the order the server (or its webhook) created for a payment. */
async function waitForOrder(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  intervalMs: number
): Promise<string | null> {
  for (let attempt = 0; attempt < ORDER_POLL_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    try {
      const { orders = [] } = await apiClient.orders.list();
      const match = orders.find(
        (order) => order.razorpayOrderId === razorpayOrderId || order.razorpayPaymentId === razorpayPaymentId
      );
      if (match) return String(match._id);
    } catch {
      // Keep looking: a failed check says nothing about the order.
    }
  }
  return null;
}

export async function payWithRazorpay(
  request: OrderRequest & { prefill?: { name?: string; email?: string; contact?: string } },
  options: { pollIntervalMs?: number } = {}
): Promise<OnlineOutcome> {
  const couponCode = request.couponCode || undefined;

  // The server prices the cart again and stores exactly what this payment is for.
  const razorpayOrder = await apiClient.orders.razorpayCreateOrder({
    items: request.items,
    shippingAddress: request.shippingAddress,
    couponCode,
  });
  if (!sameAmount(razorpayOrder.totalAmount, request.expectedTotal)) {
    return { kind: 'price-changed' };
  }

  const payment = await openRazorpayCheckout({
    orderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    prefill: request.prefill,
  });
  if (payment.status === 'cancelled') return { kind: 'cancelled' };
  if (payment.status === 'failed') return { kind: 'failed', message: payment.message };

  // Paid. The customer has been charged from here on.
  try {
    const verified = await apiClient.orders.razorpayVerify({
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId,
      razorpaySignature: payment.razorpaySignature,
      shippingAddress: request.shippingAddress,
    });
    return { kind: 'placed', orderId: verified.orderId };
  } catch (error) {
    // The confirmation call failed (network, timeout, server busy). The
    // server's webhook completes the order independently, so look for it.
    const orderId = await waitForOrder(
      payment.razorpayOrderId,
      payment.razorpayPaymentId,
      options.pollIntervalMs ?? ORDER_POLL_INTERVAL_MS
    );
    if (orderId) return { kind: 'placed', orderId };
    const apiError = toApiError(error);
    return {
      kind: 'pending',
      paymentId: payment.razorpayPaymentId,
      serverMessage: apiError.status > 0 ? apiError.message : undefined,
    };
  }
}
