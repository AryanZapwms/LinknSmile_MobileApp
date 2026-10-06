// services/vendor-access.ts
// Which parts of the seller area are open, decided the way the server decides
// it (web repo: lib/vendor-guard.ts; docs/mobile-api.md, "Vendor").
//
// The app mirrors these rules only to show the right screen. The server
// enforces them on every request regardless of what the app shows.

import type { ErrorCode, VendorStatusResponse } from '../contracts';

/** GET /api/vendor/status. */
export type VendorStatus = VendorStatusResponse;

/** Why a seller can't use something: the codes the server's 403 responses carry. */
export type VendorBlock = Extract<ErrorCode, 'MOU_REQUIRED' | 'SUBSCRIPTION_EXPIRED' | 'SHOP_PENDING'>;

/**
 * - `selling`: orders and products (on the server also coupons and reviews).
 *   Needs the agreement accepted, a subscription that is active or in its
 *   grace period, and an approved shop.
 * - `account`: dashboard figures, wallet, ledger, payouts, bank details and
 *   shop settings. Needs the agreement only, so money already earned stays
 *   reachable after the subscription has lapsed.
 */
export type VendorFeature = 'selling' | 'account';

const BLOCK_CODES: readonly string[] = ['MOU_REQUIRED', 'SUBSCRIPTION_EXPIRED', 'SHOP_PENDING'];

export function isVendorBlock(code: unknown): code is VendorBlock {
  return typeof code === 'string' && BLOCK_CODES.includes(code);
}

/**
 * The first rule that blocks `feature`, or null when it is open. Checked in
 * the server's order: agreement, then subscription, then shop approval.
 */
export function vendorBlock(status: VendorStatus, feature: VendorFeature): VendorBlock | null {
  if (status.blockingCode === 'MOU_REQUIRED') return 'MOU_REQUIRED';
  if (feature === 'selling') {
    if (status.blockingCode === 'SUBSCRIPTION_EXPIRED') return 'SUBSCRIPTION_EXPIRED';
    if (!status.isApproved) return 'SHOP_PENDING';
  }
  return null;
}

/**
 * What to tell the seller about each block. The subscription text states the
 * status only: the app must not offer or point to a way to pay for a renewal
 * (App Store guideline 3.1.1).
 */
export const BLOCK_COPY: Record<VendorBlock, { title: string; message: string }> = {
  MOU_REQUIRED: {
    title: 'Vendor agreement',
    message: 'Please review and accept the vendor agreement to continue.',
  },
  SUBSCRIPTION_EXPIRED: {
    title: 'Selling is paused',
    message:
      'Your seller subscription is not active, so orders and products are locked. Your wallet, payouts and bank details are still available.',
  },
  SHOP_PENDING: {
    title: 'Awaiting approval',
    message: 'Your shop is being reviewed. Orders and products open as soon as it is approved.',
  },
};

// ── Subscription wording ─────────────────────────────────────────────────────

export type StatusTone = 'ok' | 'warning' | 'blocked';

export interface SubscriptionSummary {
  label: string;
  tone: StatusTone;
  detail: string;
}

/** From this many days before expiry the subscription is shown as ending soon. */
const ENDING_SOON_DAYS = 14;

/** "5 March 2027", or '' when there is no usable date. */
export function formatStatusDate(isoDate: string | null | undefined): string {
  const time = isoDate ? Date.parse(isoDate) : NaN;
  if (Number.isNaN(time)) return '';
  return new Date(time).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** The subscription part of the status, in the seller's words. */
export function describeSubscription(subscription: VendorStatus['subscription']): SubscriptionSummary {
  const expiry = formatStatusDate(subscription.expiryDate);
  const days = subscription.daysUntilExpiry;

  switch (subscription.status) {
    case 'active':
      if (days !== null && days <= ENDING_SOON_DAYS) {
        const when = days <= 0 ? 'in less than a day' : `in ${days} day${days === 1 ? '' : 's'}`;
        return { label: 'Active', tone: 'warning', detail: `Ends ${when}${expiry ? ` (${expiry})` : ''}.` };
      }
      return { label: 'Active', tone: 'ok', detail: expiry ? `Valid until ${expiry}.` : 'Your subscription is active.' };

    case 'grace_period':
      return {
        label: 'Expired, in grace period',
        tone: 'warning',
        detail: `${expiry ? `Expired on ${expiry}.` : 'Your subscription has expired.'} Orders and products stay open for up to 7 days after the expiry date.`,
      };

    case 'blocked':
      return {
        label: 'Not active',
        tone: 'blocked',
        // A cancelled subscription can be blocked before its expiry date.
        detail: expiry && days !== null && days < 0 ? `Expired on ${expiry}.` : 'Your subscription is not active.',
      };

    case 'no_subscription':
      return { label: 'No subscription', tone: 'blocked', detail: 'This shop does not have a subscription yet.' };
  }
}
