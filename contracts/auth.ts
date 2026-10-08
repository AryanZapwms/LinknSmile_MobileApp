// lib/contracts/auth.ts — /api/mobile-auth/*
import { z } from "zod";

export const mobileLoginRequest = z.object({
  email: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(200),
  deviceName: z.string().max(100).optional(),
});
export type MobileLoginRequest = z.infer<typeof mobileLoginRequest>;

export const authUser = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(["user", "admin", "shop_owner"]),
  shopId: z.string().nullable(),
});
export type AuthUserDto = z.infer<typeof authUser>;

export const tokenPair = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.string().datetime(),
  refreshToken: z.string().startsWith("rt_"),
  refreshTokenExpiresAt: z.string().datetime(),
  tokenType: z.literal("Bearer"),
});
export type TokenPairDto = z.infer<typeof tokenPair>;

export const mobileLoginResponse = tokenPair.extend({
  success: z.literal(true),
  user: authUser,
  /** @deprecated legacy cookie token for app versions before the Bearer scheme. */
  token: z.string(),
});
export type MobileLoginResponse = z.infer<typeof mobileLoginResponse>;

export const refreshRequest = z.object({
  refreshToken: z.string().min(1).max(200),
});
export type RefreshRequest = z.infer<typeof refreshRequest>;

export const refreshResponse = tokenPair.extend({
  success: z.literal(true),
  user: authUser,
});
export type RefreshResponse = z.infer<typeof refreshResponse>;

export const logoutRequest = z.object({
  refreshToken: z.string().max(200).optional(),
  /** Expo push token of this device; removed from the user so logged-out devices get no pushes. */
  pushToken: z.string().max(300).optional(),
});
export type LogoutRequest = z.infer<typeof logoutRequest>;

export const logoutResponse = z.object({ success: z.literal(true) });
export type LogoutResponse = z.infer<typeof logoutResponse>;
