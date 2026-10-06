// services/vendor-access.ts: the seller area opens and locks by the same
// rules the server applies (web repo: lib/vendor-guard.ts).
import {
  describeSubscription,
  isVendorBlock,
  vendorBlock,
  type VendorStatus,
} from '../services/vendor-access';

/** A seller with nothing in the way; tests override what they are about. */
function status(overrides: Partial<Omit<VendorStatus, 'subscription'>> = {}, subscription: Partial<VendorStatus['subscription']> = {}): VendorStatus {
  return {
    success: true,
    isApproved: true,
    isActive: true,
    mouAccepted: true,
    mouVersion: '1.0.0',
    blockingCode: null,
    ...overrides,
    subscription: {
      status: 'active',
      expiryDate: '2027-03-05T12:00:00.000Z',
      daysUntilExpiry: 120,
      isInGracePeriod: false,
      isBlocked: false,
      source: 'paid',
      ...subscription,
    },
  };
}

const agreementNotAccepted = status({ mouAccepted: false, blockingCode: 'MOU_REQUIRED' });
const subscriptionExpired = status({ blockingCode: 'SUBSCRIPTION_EXPIRED' }, { status: 'blocked', isBlocked: true, daysUntilExpiry: -12 });
const inGracePeriod = status({}, { status: 'grace_period', isInGracePeriod: true, daysUntilExpiry: -3 });
const awaitingApproval = status({ isApproved: false });

describe('vendorBlock', () => {
  it('opens everything for an approved seller with an accepted agreement and active subscription', () => {
    expect(vendorBlock(status(), 'selling')).toBeNull();
    expect(vendorBlock(status(), 'account')).toBeNull();
  });

  it('MOU_REQUIRED blocks the whole seller area', () => {
    expect(vendorBlock(agreementNotAccepted, 'selling')).toBe('MOU_REQUIRED');
    expect(vendorBlock(agreementNotAccepted, 'account')).toBe('MOU_REQUIRED');
  });

  it('SUBSCRIPTION_EXPIRED locks orders and products but leaves wallet, payouts and bank details open', () => {
    expect(vendorBlock(subscriptionExpired, 'selling')).toBe('SUBSCRIPTION_EXPIRED');
    expect(vendorBlock(subscriptionExpired, 'account')).toBeNull();
  });

  it('keeps selling open during the grace period', () => {
    expect(vendorBlock(inGracePeriod, 'selling')).toBeNull();
  });

  it('a shop awaiting approval cannot sell yet, but the account side is open', () => {
    expect(vendorBlock(awaitingApproval, 'selling')).toBe('SHOP_PENDING');
    expect(vendorBlock(awaitingApproval, 'account')).toBeNull();
  });

  it("reports blocks in the server's order: agreement, then subscription, then approval", () => {
    const everythingWrong = status(
      { mouAccepted: false, isApproved: false, blockingCode: 'MOU_REQUIRED' },
      { status: 'no_subscription', isBlocked: true }
    );
    expect(vendorBlock(everythingWrong, 'selling')).toBe('MOU_REQUIRED');

    const agreementAccepted = { ...everythingWrong, mouAccepted: true, blockingCode: 'SUBSCRIPTION_EXPIRED' as const };
    expect(vendorBlock(agreementAccepted, 'selling')).toBe('SUBSCRIPTION_EXPIRED');

    const subscribed = { ...agreementAccepted, blockingCode: null };
    expect(vendorBlock(subscribed, 'selling')).toBe('SHOP_PENDING');
  });
});

describe('isVendorBlock', () => {
  it('recognises exactly the three gate codes', () => {
    expect(['MOU_REQUIRED', 'SUBSCRIPTION_EXPIRED', 'SHOP_PENDING'].map(isVendorBlock)).toEqual([true, true, true]);
    expect(['NOT_VENDOR', 'SHOP_NOT_FOUND', 'FORBIDDEN', '', undefined, 403].map(isVendorBlock)).toEqual([
      false, false, false, false, false, false,
    ]);
  });
});

describe('describeSubscription', () => {
  const describe_ = (subscription: Partial<VendorStatus['subscription']>) =>
    describeSubscription(status({}, subscription).subscription);

  it('active with plenty of time left', () => {
    expect(describe_({})).toEqual({ label: 'Active', tone: 'ok', detail: 'Valid until 5 March 2027.' });
  });

  it('active but ending within two weeks is a warning', () => {
    expect(describe_({ daysUntilExpiry: 3 })).toMatchObject({ tone: 'warning', detail: 'Ends in 3 days (5 March 2027).' });
    expect(describe_({ daysUntilExpiry: 1 }).detail).toBe('Ends in 1 day (5 March 2027).');
    expect(describe_({ daysUntilExpiry: 0 }).detail).toBe('Ends in less than a day (5 March 2027).');
  });

  it('grace period: expired, but selling is still open', () => {
    const summary = describe_({ status: 'grace_period', isInGracePeriod: true, daysUntilExpiry: -3 });
    expect(summary.tone).toBe('warning');
    expect(summary.detail).toBe(
      'Expired on 5 March 2027. Orders and products stay open for up to 7 days after the expiry date.'
    );
  });

  it('blocked after expiry names the date; blocked before it (cancelled) does not claim it expired', () => {
    expect(describe_({ status: 'blocked', isBlocked: true, daysUntilExpiry: -12 })).toEqual({
      label: 'Not active',
      tone: 'blocked',
      detail: 'Expired on 5 March 2027.',
    });
    expect(describe_({ status: 'blocked', isBlocked: true, daysUntilExpiry: 40 }).detail).toBe(
      'Your subscription is not active.'
    );
  });

  it('no subscription at all', () => {
    const summary = describe_({ status: 'no_subscription', isBlocked: true, expiryDate: null, daysUntilExpiry: null });
    expect(summary).toMatchObject({ label: 'No subscription', tone: 'blocked' });
  });

  it('never tells the seller where or how to pay (App Store guideline 3.1.1)', () => {
    const everyState = [
      describe_({}),
      describe_({ daysUntilExpiry: 2 }),
      describe_({ status: 'grace_period', daysUntilExpiry: -1 }),
      describe_({ status: 'blocked', daysUntilExpiry: -30 }),
      describe_({ status: 'no_subscription', expiryDate: null, daysUntilExpiry: null }),
    ];
    for (const { label, detail } of everyState) {
      expect(`${label} ${detail}`).not.toMatch(/renew|pay|purchase|buy|website|http/i);
    }
  });
});
