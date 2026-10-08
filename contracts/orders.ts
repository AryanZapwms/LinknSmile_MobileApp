// lib/contracts/orders.ts — COD orders, Razorpay checkout, coupons.
import { z } from "zod";
import { cartItemInput } from "./pricing";

/**
 * Shipping address as the Order schema stores it. Keys outside this list
 * are silently dropped by the server (the old app's addressLine1/2 were).
 */
export const shippingAddress = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().optional(),
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  /** India: 6-digit PIN. The server also reads zipCode for other regions. */
  pincode: z.string().min(1),
  zipCode: z.string().optional(),
  country: z.string().default("India"),
});
export type ShippingAddress = z.infer<typeof shippingAddress>;

// POST /api/orders — cash on delivery only. Send X-Idempotency-Key.
export const codOrderRequest = z.object({
  items: z.array(cartItemInput).min(1),
  shippingAddress,
  couponCode: z.string().optional(),
  /** Only "cod" (or omitted) is accepted here; online payments use /api/razorpay/*. */
  paymentMethod: z.literal("cod").optional(),
});
export type CodOrderRequest = z.infer<typeof codOrderRequest>;
export const codOrderResponse = z.object({
  success: z.literal(true),
  orderId: z.string(),
  orderNumber: z.string(),
  message: z.string(),
});
export type CodOrderResponse = z.infer<typeof codOrderResponse>;

const orderItem = z
  .object({
    product: z.union([z.string(), z.object({ _id: z.string(), name: z.string().optional(), image: z.string().nullish(), slug: z.string().optional() }).passthrough(), z.null()]),
    quantity: z.number(),
    price: z.number(),
    shopId: z.string().nullish(),
    shopName: z.string().nullish(),
  })
  .passthrough();
export const order = z
  .object({
    _id: z.string(),
    orderNumber: z.string(),
    items: z.array(orderItem),
    totalAmount: z.number(),
    taxAmount: z.number().optional(),
    discountAmount: z.number().optional(),
    shippingAddress: shippingAddress.partial().passthrough().nullish(),
    paymentMethod: z.enum(["cod", "razorpay", "tap"]),
    paymentStatus: z.enum(["pending", "completed", "failed"]),
    orderStatus: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]),
    createdAt: z.string(),
  })
  .passthrough();
export type OrderDto = z.infer<typeof order>;
export const orderListResponse = z.object({ orders: z.array(order) });

// POST /api/razorpay/create-order → open the Razorpay SDK with id/amount/currency
export const razorpayCreateOrderRequest = z.object({
  items: z.array(cartItemInput).min(1),
  couponCode: z.string().optional(),
  shippingAddress,
});
export const razorpayCreateOrderResponse = z
  .object({ id: z.string(), amount: z.number().int(), currency: z.string(), totalAmount: z.number() })
  .passthrough();

// POST /api/razorpay/verify-payment → then show order success for orderId
export const razorpayVerifyRequest = z.object({
  razorpayOrderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
  shippingAddress: shippingAddress.optional(),
});
export const razorpayVerifyResponse = z.object({ success: z.literal(true), orderId: z.string() });

// POST /api/coupons/validate (prefer /api/pricing/quote, which returns the full breakdown)
export const couponValidateRequest = z.object({ items: z.array(cartItemInput).min(1), couponCode: z.string().min(1) });
export const couponValidateResponse = z.object({
  success: z.literal(true),
  discountAmount: z.number(),
  totalAmount: z.number(),
  taxRatePercent: z.number(),
  taxAmount: z.number(),
  code: z.string(),
});
