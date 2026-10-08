// lib/contracts/users.ts — /api/users/push-token, /api/users/me
import { z } from "zod";

export const expoPushToken = z.string().regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, "must be an Expo push token").max(300);

export const pushTokenRequest = z.object({
  token: expoPushToken,
  platform: z.enum(["ios", "android"]).optional(),
});
export type PushTokenRequest = z.infer<typeof pushTokenRequest>;

export const pushTokenResponse = z.object({ success: z.literal(true) });
export type PushTokenResponse = z.infer<typeof pushTokenResponse>;

export const deleteAccountRequest = z.object({
  confirm: z.literal("DELETE"),
  /** Required when the account has a password (not needed for Google-only accounts). */
  password: z.string().max(200).optional(),
});
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequest>;

export const deleteAccountResponse = z.object({ success: z.literal(true) });
export type DeleteAccountResponse = z.infer<typeof deleteAccountResponse>;

/** 409 bodies. Vendor codes come from the vendor exit flow, which runs first for vendors. */
export const deleteAccountBlocked = z.object({
  error: z.string(),
  code: z.enum(["OPEN_ORDERS", "WALLET_FROZEN", "PENDING_SALES", "PAYOUT_IN_PROGRESS", "BANK_DETAILS_REQUIRED"]),
  openOrders: z.number().int().optional(),
});
