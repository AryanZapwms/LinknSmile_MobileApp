// lib/contracts/pricing.ts — POST /api/pricing/quote
import { z } from "zod";
import { objectId } from "./common";

export const cartItemInput = z.object({
  product: objectId,
  quantity: z.number().int().min(1).max(999),
  /** A size variant: both fields must match one of the product's sizes. */
  selectedSize: z.object({ size: z.string().min(1), quantity: z.number() }).nullish(),
});
export type CartItemInputDto = z.infer<typeof cartItemInput>;

export const quoteRequest = z.object({
  items: z.array(cartItemInput).min(1).max(50),
  couponCode: z.string().trim().min(1).max(50).optional(),
});
export type QuoteRequest = z.infer<typeof quoteRequest>;

export const quoteResponse = z.object({
  success: z.literal(true),
  currency: z.string(),
  items: z.array(
    z.object({
      product: z.string(),
      name: z.string(),
      quantity: z.number().int(),
      unitPrice: z.number(),
      lineTotal: z.number(),
      selectedSize: z
        .object({ size: z.string(), unit: z.string().optional(), quantity: z.number(), price: z.number(), discountPrice: z.number().nullish() })
        .nullable(),
      shopId: z.string(),
      shopName: z.string(),
    })
  ),
  subtotal: z.number(),
  discountAmount: z.number(),
  coupon: z.object({ code: z.string(), shopId: z.string(), discountAmount: z.number() }).nullable(),
  taxRatePercent: z.number(),
  taxAmount: z.number(),
  /** Always 0 — the server charges no shipping. */
  shippingAmount: z.literal(0),
  /** What the order will be charged: subtotal − discountAmount + taxAmount. */
  totalAmount: z.number(),
});
export type QuoteResponse = z.infer<typeof quoteResponse>;
