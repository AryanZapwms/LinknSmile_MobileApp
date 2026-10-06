// lib/contracts — the API contract between this backend and the mobile app.
//
// zod schemas (runtime validation) + inferred TS types for every route the
// India mobile app uses. Free of Node/Next/Mongoose imports so the mobile
// app can consume this folder as-is (copy, git submodule, or a future
// packages/shared). tests/contracts.test.ts checks every route below.
//
// Conventions:
// - Auth: `Authorization: Bearer <accessToken>` from /api/mobile-auth/login|refresh.
// - Errors on new/mobile-specific routes: `{ error, code }` (lib/contracts/errors.ts).
//   Older routes still return `{ error }` or `{ message }` only; switch on HTTP
//   status there and on `code` when present.

export * from "./errors";
export * from "./common";
export * from "./auth";
export * from "./products";
export * from "./pricing";
export * from "./users";
export * from "./app-config";
export * from "./customer";
export * from "./orders";
export * from "./vendor";

import type { ZodTypeAny } from "zod";
import * as auth from "./auth";
import * as products from "./products";
import * as pricing from "./pricing";
import * as users from "./users";
import * as appConfig from "./app-config";
import * as customer from "./customer";
import * as orders from "./orders";
import * as vendor from "./vendor";

export type RouteAuth = "none" | "optional" | "user" | "vendor" | "vendor-approved";

export interface RouteContract {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  auth: RouteAuth;
  request?: ZodTypeAny;
  response?: ZodTypeAny;
  /** Returns `{ error, code }` on failure. */
  errorCodes?: boolean;
}

/** Every route the India mobile app calls. */
export const MOBILE_ROUTES: RouteContract[] = [
  // auth
  { method: "POST", path: "/api/mobile-auth/login", auth: "none", request: auth.mobileLoginRequest, response: auth.mobileLoginResponse, errorCodes: true },
  { method: "POST", path: "/api/mobile-auth/refresh", auth: "none", request: auth.refreshRequest, response: auth.refreshResponse, errorCodes: true },
  { method: "POST", path: "/api/mobile-auth/logout", auth: "optional", request: auth.logoutRequest, response: auth.logoutResponse, errorCodes: true },
  { method: "POST", path: "/api/auth/change-password", auth: "user", request: customer.changePasswordRequest, response: customer.changePasswordResponse },
  // config & catalogue
  { method: "GET", path: "/api/app-config", auth: "none", response: appConfig.appConfigResponse },
  { method: "GET", path: "/api/products", auth: "none", request: products.productListQuery, response: products.productListResponse },
  { method: "POST", path: "/api/pricing/quote", auth: "optional", request: pricing.quoteRequest, response: pricing.quoteResponse, errorCodes: true },
  // account
  { method: "GET", path: "/api/users/profile", auth: "user", response: customer.profileResponse },
  { method: "PUT", path: "/api/users/profile", auth: "user", request: customer.profileUpdateRequest },
  { method: "POST", path: "/api/users/push-token", auth: "user", request: users.pushTokenRequest, response: users.pushTokenResponse, errorCodes: true },
  { method: "DELETE", path: "/api/users/push-token", auth: "user", request: users.pushTokenRequest, response: users.pushTokenResponse, errorCodes: true },
  { method: "DELETE", path: "/api/users/me", auth: "user", request: users.deleteAccountRequest, response: users.deleteAccountResponse, errorCodes: true },
  { method: "GET", path: "/api/addresses", auth: "user", response: customer.addressListResponse },
  { method: "POST", path: "/api/addresses", auth: "user", request: customer.addressCreateRequest, response: customer.address },
  { method: "PUT", path: "/api/addresses/:id", auth: "user", request: customer.addressUpdateRequest, response: customer.address },
  { method: "DELETE", path: "/api/addresses/:id", auth: "user" },
  { method: "GET", path: "/api/cart", auth: "user", response: customer.cartGetResponse },
  { method: "POST", path: "/api/cart", auth: "user", request: customer.cartPutRequest, response: customer.cartPostResponse },
  { method: "GET", path: "/api/favourites", auth: "user", response: customer.favouriteListResponse },
  { method: "POST", path: "/api/favourites", auth: "user", request: customer.favouriteToggleRequest, response: customer.favouriteToggleResponse },
  // orders & payment
  { method: "GET", path: "/api/orders", auth: "user", response: orders.orderListResponse },
  { method: "POST", path: "/api/orders", auth: "user", request: orders.codOrderRequest, response: orders.codOrderResponse },
  { method: "POST", path: "/api/coupons/validate", auth: "user", request: orders.couponValidateRequest, response: orders.couponValidateResponse },
  { method: "POST", path: "/api/razorpay/create-order", auth: "user", request: orders.razorpayCreateOrderRequest, response: orders.razorpayCreateOrderResponse },
  { method: "POST", path: "/api/razorpay/verify-payment", auth: "user", request: orders.razorpayVerifyRequest, response: orders.razorpayVerifyResponse },
  // vendor — never blocked
  { method: "GET", path: "/api/vendor/status", auth: "vendor", response: vendor.vendorStatusResponse },
  { method: "GET", path: "/api/vendor/mou", auth: "vendor", response: vendor.vendorMouResponse },
  { method: "POST", path: "/api/vendor/mou", auth: "vendor", response: vendor.vendorMouAcceptResponse },
  // vendor — MOU only (open with an expired subscription: earned money stays reachable)
  { method: "GET", path: "/api/vendor/stats", auth: "vendor", response: vendor.vendorStatsResponse, errorCodes: true },
  { method: "GET", path: "/api/vendor/wallet", auth: "vendor", response: vendor.vendorWalletResponse, errorCodes: true },
  { method: "GET", path: "/api/vendor/wallet/ledger", auth: "vendor", response: vendor.vendorLedgerResponse, errorCodes: true },
  { method: "GET", path: "/api/vendor/payouts", auth: "vendor", response: vendor.vendorPayoutsResponse, errorCodes: true },
  { method: "POST", path: "/api/vendor/payouts", auth: "vendor", request: vendor.vendorPayoutRequest, errorCodes: true },
  { method: "GET", path: "/api/vendor/bank-details", auth: "vendor", response: vendor.vendorBankDetailsResponse, errorCodes: true },
  { method: "PUT", path: "/api/vendor/bank-details", auth: "vendor", request: vendor.bankDetails, errorCodes: true },
  { method: "GET", path: "/api/vendor/settings", auth: "vendor", errorCodes: true },
  // vendor — selling features: MOU + subscription + approved shop
  { method: "GET", path: "/api/vendor/orders", auth: "vendor-approved", response: vendor.vendorOrderListResponse, errorCodes: true },
  { method: "PATCH", path: "/api/vendor/orders/:id", auth: "vendor-approved", request: vendor.vendorOrderStatusRequest, errorCodes: true },
  { method: "GET", path: "/api/vendor/products", auth: "vendor-approved", response: vendor.vendorProductListResponse, errorCodes: true },
  { method: "GET", path: "/api/vendor/products/stats", auth: "vendor-approved", errorCodes: true },
  { method: "GET", path: "/api/vendor/reviews", auth: "vendor-approved", errorCodes: true },
  { method: "GET", path: "/api/vendor/coupons", auth: "vendor-approved", errorCodes: true },
  // vendor subscription: status only from the app (403 PAYMENT_NOT_AVAILABLE_ON_MOBILE;
  // its other errors are the older `{ error }` shape)
  { method: "POST", path: "/api/vendor/subscription/create-order", auth: "vendor", response: vendor.subscriptionPaymentBlocked },
];
