// lib/contracts/vendor.ts — /api/vendor/*
import { z } from "zod";

export const subscriptionAccessStatus = z.enum(["no_subscription", "active", "grace_period", "blocked"]);
export type SubscriptionAccessStatus = z.infer<typeof subscriptionAccessStatus>;

/** 403 bodies from lib/vendor-guard.ts. `message` repeats `error`. */
export const vendorBlockedBody = z.discriminatedUnion("code", [
  z.object({ code: z.literal("MOU_REQUIRED"), error: z.string(), message: z.string(), mouVersion: z.string() }),
  z.object({ code: z.literal("SUBSCRIPTION_EXPIRED"), error: z.string(), message: z.string(), subscriptionStatus: subscriptionAccessStatus, expiryDate: z.string().nullable() }),
  z.object({ code: z.literal("SHOP_PENDING"), error: z.string(), message: z.string() }),
]);
export type VendorBlockedBody = z.infer<typeof vendorBlockedBody>;

// GET /api/vendor/status — never blocked; drive the vendor area from blockingCode.
export const vendorStatusResponse = z.object({
  success: z.literal(true),
  isApproved: z.boolean(),
  isActive: z.boolean(),
  mouAccepted: z.boolean(),
  mouVersion: z.string(),
  /**
   * MOU_REQUIRED blocks the whole vendor area. SUBSCRIPTION_EXPIRED blocks
   * orders/products/coupons/reviews only — wallet, ledger, payouts, bank
   * details, settings and stats stay open. null = open (selling features
   * also need isApproved).
   */
  blockingCode: z.enum(["MOU_REQUIRED", "SUBSCRIPTION_EXPIRED"]).nullable(),
  subscription: z.object({
    status: subscriptionAccessStatus,
    expiryDate: z.string().nullable(),
    daysUntilExpiry: z.number().nullable(),
    isInGracePeriod: z.boolean(),
    isBlocked: z.boolean(),
    source: z.enum(["paid", "comped"]),
  }),
});
export type VendorStatusResponse = z.infer<typeof vendorStatusResponse>;

// GET/POST /api/vendor/mou
export const vendorMouResponse = z.object({
  success: z.literal(true),
  version: z.string(),
  content: z.string(),
  accepted: z.boolean(),
  acceptedAt: z.string().nullable(),
});
export const vendorMouAcceptResponse = z.object({ success: z.literal(true), accepted: z.literal(true), acceptedAt: z.string() }).passthrough();

// Subscription payment endpoints, when called from the app (Bearer).
export const subscriptionPaymentBlocked = z.object({
  code: z.literal("PAYMENT_NOT_AVAILABLE_ON_MOBILE"),
  error: z.string(),
  subscription: z
    .object({ status: subscriptionAccessStatus, daysUntilExpiry: z.number().nullable(), isInGracePeriod: z.boolean(), isBlocked: z.boolean() })
    .nullable(),
});

// GET /api/vendor/stats
export const vendorStatsResponse = z
  .object({
    success: z.literal(true),
    stats: z.object({
      totalProducts: z.number(),
      pendingApproval: z.number(),
      approvedProducts: z.number(),
      rejectedProducts: z.number(),
      totalOrders: z.number(),
      totalEarnings: z.number(),
      pendingPayouts: z.number(),
    }).passthrough(),
    shop: z.object({ name: z.string(), isApproved: z.boolean(), isActive: z.boolean() }).passthrough(),
  })
  .passthrough();

// GET /api/vendor/wallet
export const vendorWalletResponse = z
  .object({
    totalBalance: z.number(),
    pendingBalance: z.number(),
    withdrawableBalance: z.number(),
    frozenBalance: z.number(),
    minimumWithdrawalThreshold: z.number(),
    isFrozen: z.boolean(),
    isClosed: z.boolean(),
    currency: z.string(),
  })
  .passthrough();

// GET /api/vendor/wallet/ledger?page=&limit=
export const vendorLedgerResponse = z.object({
  entries: z.array(
    z.object({ _id: z.string(), type: z.string(), amount: z.number(), status: z.string(), description: z.string().nullish(), createdAt: z.string(), referenceType: z.string().nullish(), referenceId: z.string().nullish() }).passthrough()
  ),
  total: z.number(),
  page: z.number(),
  pages: z.number(),
});

// GET/POST /api/vendor/payouts
export const vendorPayoutsResponse = z
  .object({
    success: z.literal(true),
    wallet: z.object({ pendingBalance: z.number(), withdrawableBalance: z.number(), frozenBalance: z.number(), minimumThreshold: z.number(), status: z.string() }).passthrough(),
    payouts: z.array(z.object({ _id: z.string(), amount: z.number(), status: z.string() }).passthrough()),
  })
  .passthrough();
export const vendorPayoutRequest = z.object({ amount: z.number().positive(), notes: z.string().optional() });

// GET/PUT /api/vendor/bank-details
export const bankDetails = z.object({
  accountHolderName: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  swiftCode: z.string().optional(),
  upiId: z.string().optional(),
});
export const vendorBankDetailsResponse = z.object({ success: z.literal(true), bankDetails: bankDetails.passthrough().nullable(), isComplete: z.boolean() }).passthrough();

// GET /api/vendor/orders?status=&page=&limit=
export const vendorOrder = z
  .object({
    _id: z.string(),
    orderNumber: z.string(),
    items: z.array(z.object({ quantity: z.number(), price: z.number() }).passthrough()),
    vendorSubtotal: z.number(),
    vendorEarnings: z.number(),
    payoutStatus: z.string(),
    paymentMethod: z.string(),
    paymentStatus: z.string(),
    orderStatus: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]),
    createdAt: z.string(),
  })
  .passthrough();
export const vendorOrderListResponse = z.object({
  success: z.literal(true),
  orders: z.array(vendorOrder),
  pagination: z.object({ page: z.number(), limit: z.number(), total: z.number(), pages: z.number() }),
});
export const vendorOrderStatusRequest = z.object({
  orderStatus: z.enum(["processing", "shipped", "delivered", "cancelled"]),
  cancellationReason: z.string().optional(),
});

// GET /api/vendor/products?status=&search=&page=&limit=
export const vendorProductListResponse = z.object({
  success: z.literal(true),
  products: z.array(z.object({ _id: z.string(), name: z.string(), price: z.number() }).passthrough()),
  pagination: z.object({ page: z.number(), limit: z.number(), total: z.number(), pages: z.number() }),
});
