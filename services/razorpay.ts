// services/razorpay.ts
// Thin wrapper around the Razorpay native checkout sheet (react-native-razorpay).
//
// The flow (docs/mobile-api.md):
//   1. POST /api/razorpay/create-order      → Razorpay order id + amount (server-priced)
//   2. openRazorpayCheckout(...)            → the customer pays in Razorpay's sheet
//   3. POST /api/razorpay/verify-payment    → the server confirms and creates the order
//
// The SDK is a native module: it exists in development/production builds but
// not in Expo Go or on web. It is loaded lazily so the app still starts there,
// and `razorpayAvailability()` says why online payment can't be offered.

import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import { RAZORPAY_KEY_ID } from './config';

export interface RazorpayCheckoutOptions {
  /** Razorpay order id from POST /api/razorpay/create-order. */
  orderId: string;
  /** Amount in paise, exactly as the server returned it. */
  amount: number;
  currency: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  themeColor?: string;
}

export type RazorpayResult =
  | { status: 'paid'; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string };

export type RazorpayAvailability = 'available' | 'missing-key' | 'missing-sdk';

function hasNativeModule(): boolean {
  if (Platform.OS === 'web') return false;
  return (
    TurboModuleRegistry.get('RNRazorpayCheckout') != null || NativeModules.RNRazorpayCheckout != null
  );
}

/** Whether the Razorpay sheet can be opened in this build. */
export function razorpayAvailability(): RazorpayAvailability {
  if (!RAZORPAY_KEY_ID) return 'missing-key';
  return hasNativeModule() ? 'available' : 'missing-sdk';
}

interface SdkError {
  code?: number | string;
  description?: string;
  error?: { description?: string; reason?: string };
}

function isCancellation(error: SdkError): boolean {
  // The SDK reports "closed by the user" as code 0 on Android and 2 on iOS.
  if (error.code === 0 || error.code === 2) return true;
  if (error.error?.reason === 'payment_cancelled') return true;
  const text = `${error.description ?? ''} ${error.error?.description ?? ''}`.toLowerCase();
  return text.includes('cancel');
}

/**
 * Opens the Razorpay sheet and resolves with what happened. Never throws:
 * a closed sheet is `cancelled`, anything else that goes wrong is `failed`.
 */
export async function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<RazorpayResult> {
  if (razorpayAvailability() !== 'available') {
    return { status: 'failed', message: 'Online payment is not available in this version of the app.' };
  }

  try {
    // Loaded here, not at the top of the file: importing the package without
    // its native module (Expo Go) throws.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RazorpayCheckout = require('react-native-razorpay').default;
    const data = await RazorpayCheckout.open({
      key: RAZORPAY_KEY_ID,
      order_id: options.orderId,
      amount: options.amount,
      currency: options.currency,
      name: 'LinkAndSmile',
      description: options.description ?? 'Order payment',
      prefill: options.prefill ?? {},
      theme: { color: options.themeColor ?? '#6C5CE7' },
    });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = data ?? {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return { status: 'failed', message: 'Razorpay did not return the payment details.' };
    }
    return {
      status: 'paid',
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    };
  } catch (raw) {
    const error = (raw ?? {}) as SdkError;
    if (isCancellation(error)) return { status: 'cancelled' };
    return {
      status: 'failed',
      message:
        error.error?.description || error.description || 'The payment could not be completed. Please try again.',
    };
  }
}
