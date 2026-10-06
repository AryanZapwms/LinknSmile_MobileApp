// lib/contracts/errors.ts
//
// Every `code` a mobile-facing route can return in `{ error, code }`.
// Shared with the mobile app — add codes, never rename or reuse them.

export const ERROR_CODES = [
  // generic
  "VALIDATION_ERROR",
  "UNAUTHORIZED", // no/invalid/expired credentials → refresh, then log in
  "FORBIDDEN", // authenticated but not allowed
  "NOT_FOUND",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  // login
  "INVALID_CREDENTIALS",
  "EMAIL_NOT_VERIFIED",
  "OAUTH_ACCOUNT", // account has no password (Google sign-in only)
  "ACCOUNT_DISABLED",
  // refresh
  "REFRESH_TOKEN_INVALID", // unknown/expired/revoked → log in again
  "REFRESH_TOKEN_REUSED", // theft suspected, all sessions of that login revoked → log in again
  "REFRESH_TOKEN_ROTATED", // a concurrent refresh already used it → retry with the newest stored token
  "SESSION_REVOKED", // account deactivated or deleted → log in again
  // vendor guard (lib/vendor-guard.ts)
  "NOT_VENDOR",
  "SHOP_NOT_FOUND",
  "MOU_REQUIRED",
  "SUBSCRIPTION_EXPIRED",
  "SHOP_PENDING",
  "PAYMENT_NOT_AVAILABLE_ON_MOBILE",
  // account deletion
  "CONFIRMATION_REQUIRED",
  "OPEN_ORDERS",
  "WALLET_BALANCE", // no longer returned (vendor deletion goes through vendor exit); kept, codes are never reused
  // vendor exit (/api/vendor/exit, and vendor account deletion)
  "WALLET_FROZEN",
  "PENDING_SALES",
  "PAYOUT_IN_PROGRESS",
  "BANK_DETAILS_REQUIRED",
  // pricing / checkout
  "PRICING_ERROR",
  "PAYMENT_METHOD_DISABLED", // admin turned this payment method off → offer the other one (see /api/app-config payments)
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
