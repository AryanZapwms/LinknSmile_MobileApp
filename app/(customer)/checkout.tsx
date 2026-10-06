// app/(customer)/checkout.tsx
// Address → Review → Payment.
//
// Every amount on this screen comes from the server's quote
// (POST /api/pricing/quote): `quote.totalAmount` is exactly what the order
// will charge. The app never adds up prices, shipping or discounts itself.
// The ordering rules (idempotency, price re-check, Razorpay) live in
// services/checkout.ts.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Image, Linking, Switch,
  type KeyboardTypeOptions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { AddressDto, QuoteResponse } from '../../contracts';
import { apiClient } from '../../services/api-client';
import { errorMessage, toApiError } from '../../services/api-error';
import {
  createAttemptTracker, payWithRazorpay, placeCodOrder, priceCart, toOrderItems,
} from '../../services/checkout';
import { addressFormSchema, fieldErrors, type AddressForm } from '../../services/form-schemas';
import { razorpayAvailability } from '../../services/razorpay';
import {
  telUrl, useAppConfigStore, usePaymentMethods, useSupportContacts,
} from '../../store/app-config.store';
import { useAuthStore } from '../../store/auth.store';
import { cartItemKey, unitPrice, useCartStore, type CartItem } from '../../store/cart.store';
import { formatMoney } from '../../utils/money';
import { Theme } from '../../constants/theme';

const STEPS = ['Address', 'Review', 'Payment'];
const EMPTY_ADDRESS: AddressForm = { name: '', phone: '', street: '', city: '', state: '', pincode: '' };

type PaymentMethod = 'cod' | 'razorpay';
/** Where the order goes: a saved address, or one typed in for this order only. */
type AddressChoice = { kind: 'saved'; id: string } | { kind: 'new'; address: AddressForm };

// The customer tabs keep screens mounted, so without this a second visit would
// reopen on the previous order's step and selections. Each visit starts fresh.
export default function CheckoutScreen() {
  const [visit, setVisit] = useState(0);
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      setVisit((n) => n + 1);
    }, [])
  );
  return <Checkout key={visit} />;
}

function Checkout() {
  // `only` = a cart line key: "Buy Now" opens checkout with just that line selected.
  const { only } = useLocalSearchParams<{ only?: string }>();
  const items = useCartStore((s) => s.items);
  const removeItems = useCartStore((s) => s.removeItems);
  const user = useAuthStore((s) => s.user);
  const payments = usePaymentMethods();
  const support = useSupportContacts();
  const loadAppConfig = useAppConfigStore((s) => s.load);

  const [step, setStep] = useState(0);

  // ── Address ────────────────────────────────────────────────────────────────
  const [addresses, setAddresses] = useState<AddressDto[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [choice, setChoice] = useState<AddressChoice | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddressForm>(EMPTY_ADDRESS);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saveForLater, setSaveForLater] = useState(true);
  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await apiClient.addresses.list();
        if (cancelled) return;
        setAddresses(saved);
        const preferred = saved.find((a) => a.isDefault) ?? saved[0];
        if (preferred) setChoice({ kind: 'saved', id: preferred._id });
        else setShowForm(true);
      } catch {
        // Saved addresses are a convenience: without them the form still works.
        if (!cancelled) setShowForm(true);
      } finally {
        if (!cancelled) setAddressesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const deliveryAddress = useMemo<AddressForm | null>(() => {
    if (!choice) return null;
    if (choice.kind === 'new') return choice.address;
    const saved = addresses.find((a) => a._id === choice.id);
    return saved
      ? { name: saved.name, phone: saved.phone, street: saved.street, city: saved.city, state: saved.state, pincode: saved.pincode }
      : null;
  }, [choice, addresses]);

  // The shape the server stores: { name, phone, email?, street, city, state, pincode, country }.
  const shippingAddress = useMemo(
    () => (deliveryAddress ? { ...deliveryAddress, email: user?.email, country: 'India' } : null),
    [deliveryAddress, user?.email]
  );

  const setFormField = (field: keyof AddressForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleUseNewAddress = async () => {
    if (savingAddress) return;
    const parsed = addressFormSchema.safeParse(form);
    if (!parsed.success) {
      setFormErrors(fieldErrors(parsed.error));
      return;
    }
    const address = parsed.data;

    if (saveForLater) {
      setSavingAddress(true);
      try {
        const saved = await apiClient.addresses.create({ ...address, isDefault: addresses.length === 0 });
        setAddresses((prev) => [saved, ...prev]);
        setChoice({ kind: 'saved', id: saved._id });
      } catch {
        // Not being able to save it must not block the order.
        setChoice({ kind: 'new', address });
      } finally {
        setSavingAddress(false);
      }
    } else {
      setChoice({ kind: 'new', address });
    }
    setShowForm(false);
    setForm(EMPTY_ADDRESS);
    setStep(1);
  };

  // ── Items ──────────────────────────────────────────────────────────────────
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const selectionStarted = useRef(false);

  useEffect(() => {
    const cartKeys = items.map(cartItemKey);
    setSelectedKeys((previous) => {
      if (!selectionStarted.current) {
        if (cartKeys.length === 0) return previous;
        selectionStarted.current = true;
        return new Set(only && cartKeys.includes(only) ? [only] : cartKeys);
      }
      // Keep the customer's choices; just forget lines that left the cart.
      return new Set([...previous].filter((key) => cartKeys.includes(key)));
    });
  }, [items, only]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedKeys.has(cartItemKey(item))),
    [items, selectedKeys]
  );
  const orderItems = useMemo(() => toOrderItems(selectedItems), [selectedItems]);

  const toggleItem = (item: CartItem) => {
    const key = cartItemKey(item);
    setSelectedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Pricing (server quote) ─────────────────────────────────────────────────
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponNotice, setCouponNotice] = useState<string | null>(null);

  // What is being priced. A quote only counts while it matches this exactly.
  const quoteSignature = useMemo(() => JSON.stringify([orderItems, appliedCoupon]), [orderItems, appliedCoupon]);
  const [priced, setPricedState] = useState<{ signature: string; quote: QuoteResponse } | null>(null);
  // Mirrors `priced.signature` so the pricing effect can tell "already priced"
  // without depending on (and re-running for) the quote itself.
  const pricedSignature = useRef<string | null>(null);
  const setPriced = (value: { signature: string; quote: QuoteResponse } | null) => {
    pricedSignature.current = value?.signature ?? null;
    setPricedState(value);
  };
  const quote = priced?.signature === quoteSignature ? priced.quote : null;

  // A pricing failure, remembered together with what it was for, so it stops
  // applying as soon as the selection or coupon changes.
  const [quoteFailure, setQuoteFailure] = useState<{ signature: string; message: string } | null>(null);
  const quoteError = quoteFailure?.signature === quoteSignature ? quoteFailure.message : null;
  // "Calculating" is simply: something is selected and there is neither a
  // price nor an error for it yet.
  const quoteLoading = orderItems.length > 0 && !quote && !quoteError;
  const [quoteReload, setQuoteReload] = useState(0);
  const quoteRequest = useRef(0);

  useEffect(() => {
    const request = ++quoteRequest.current; // anything still in the air is now stale
    if (orderItems.length === 0 || pricedSignature.current === quoteSignature) return;

    // Short delay so ticking several items on/off sends one request, not five.
    const timer = setTimeout(async () => {
      try {
        const result = await priceCart(orderItems, appliedCoupon);
        if (request !== quoteRequest.current) return;
        if (result.droppedCoupon) {
          setPriced({ signature: JSON.stringify([orderItems, null]), quote: result.quote });
          setAppliedCoupon(null);
          setCouponNotice(`Coupon ${result.droppedCoupon.code} was removed: ${result.droppedCoupon.reason}`);
        } else {
          setPriced({ signature: quoteSignature, quote: result.quote });
        }
      } catch (error) {
        if (request === quoteRequest.current) {
          setQuoteFailure({ signature: quoteSignature, message: errorMessage(error, 'Could not price your cart.') });
        }
      }
    }, 250);
    return () => clearTimeout(timer);
    // orderItems/appliedCoupon are captured by quoteSignature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteSignature, quoteReload]);

  const refreshQuote = () => {
    setPriced(null);
    setQuoteFailure(null);
    setQuoteReload((n) => n + 1);
  };

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code || couponBusy || orderItems.length === 0) return;
    setCouponBusy(true);
    setCouponError(null);
    setCouponNotice(null);
    try {
      // The quote endpoint is the coupon check: it either prices the cart with
      // the discount or explains why the code can't be used.
      const result = await apiClient.pricing.quote({ items: orderItems, couponCode: code });
      if (!result.coupon) {
        setCouponError("This coupon doesn't apply to the selected items.");
        return;
      }
      setPriced({ signature: JSON.stringify([orderItems, code]), quote: result });
      setAppliedCoupon(code);
      setCouponInput('');
    } catch (error) {
      setCouponError(errorMessage(error, 'This coupon is not valid.'));
    } finally {
      setCouponBusy(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponNotice(null);
  };

  /** The server's price for one cart line, when the current quote has it. */
  const quotedLine = (item: CartItem) =>
    quote?.items.find(
      (line) =>
        line.product === item.productId &&
        (line.selectedSize?.size ?? null) === (item.selectedSize?.size ?? null) &&
        (line.selectedSize?.quantity ?? null) === (item.selectedSize?.quantity ?? null)
    );

  // ── Payment ────────────────────────────────────────────────────────────────
  const onlinePayment = razorpayAvailability();
  const methods = useMemo(
    () =>
      [
        payments.cod && {
          key: 'cod' as const, icon: 'cash-outline', label: 'Cash on Delivery',
          sub: 'Pay when you receive your order', usable: true,
        },
        payments.razorpay && {
          key: 'razorpay' as const, icon: 'card-outline', label: 'Pay Online',
          sub: onlinePayment === 'available'
            ? 'UPI, cards, net banking and wallets (Razorpay)'
            : 'Not available in this version of the app',
          usable: onlinePayment === 'available',
        },
      ].filter((m): m is Exclude<typeof m, false> => Boolean(m)),
    [payments.cod, payments.razorpay, onlinePayment]
  );
  // The method in use is the customer's choice while it is still offered,
  // otherwise the first usable one (e.g. after the admin switches one off).
  const [chosenMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const usableMethods = methods.filter((m) => m.usable).map((m) => m.key);
  const paymentMethod: PaymentMethod | null =
    chosenMethod && usableMethods.includes(chosenMethod) ? chosenMethod : usableMethods[0] ?? null;

  const [attempts] = useState(createAttemptTracker);
  const [placing, setPlacing] = useState(false);
  /** Set when a payment was taken but the order isn't confirmed yet. */
  const [pendingPayment, setPendingPayment] = useState<{ paymentId: string; serverMessage?: string } | null>(null);

  const orderedKeys = () => selectedItems.map(cartItemKey);

  const finishOrder = (orderId: string, orderNumber?: string) => {
    attempts.reset();
    router.replace({
      pathname: '/(customer)/order-success/[id]',
      params: { id: orderId, ...(orderNumber ? { orderNumber } : {}) },
    });
    // Only the lines that were ordered leave the cart. The server emptied its
    // copy when it created the order, so this also re-uploads the rest.
    removeItems(orderedKeys());
  };

  const showPriceChanged = (newQuote?: QuoteResponse) => {
    if (newQuote) setPriced({ signature: quoteSignature, quote: newQuote });
    else refreshQuote();
    Alert.alert(
      'Price updated',
      newQuote
        ? `The total for your order is now ${formatMoney(newQuote.totalAmount, newQuote.currency)}. Please check it and confirm again. Nothing has been ordered or charged.`
        : 'The price of your order changed. Please check the new total and confirm again. Nothing has been ordered or charged.'
    );
  };

  const handlePlaceOrder = async () => {
    if (placing || !quote || !shippingAddress || !paymentMethod || selectedItems.length === 0) return;
    setPlacing(true);

    const request = {
      items: orderItems,
      shippingAddress,
      couponCode: appliedCoupon,
      expectedTotal: quote.totalAmount,
    };

    try {
      if (paymentMethod === 'cod') {
        // Same cart + coupon + address = same attempt = same idempotency key.
        const attempt = attempts.attemptFor(JSON.stringify([orderItems, appliedCoupon, shippingAddress]));
        const outcome = await placeCodOrder(request, attempt);
        if (outcome.kind === 'price-changed') showPriceChanged(outcome.quote);
        else finishOrder(outcome.orderId, outcome.orderNumber);
        return;
      }

      const outcome = await payWithRazorpay({
        ...request,
        prefill: { name: shippingAddress.name, email: user?.email, contact: shippingAddress.phone },
      });
      switch (outcome.kind) {
        case 'placed':
          finishOrder(outcome.orderId);
          break;
        case 'price-changed':
          showPriceChanged();
          break;
        case 'cancelled':
          break; // back on the payment step; nothing was charged
        case 'failed':
          Alert.alert('Payment not completed', `${outcome.message}\n\nYou have not been charged.`);
          break;
        case 'pending':
          // Charged, order not confirmed yet: never invite a second payment.
          attempts.reset();
          setPendingPayment({ paymentId: outcome.paymentId, serverMessage: outcome.serverMessage });
          removeItems(orderedKeys());
          break;
      }
    } catch (error) {
      const apiError = toApiError(error, 'Could not place the order. Please try again.');
      if (apiError.code === 'PAYMENT_METHOD_DISABLED') {
        void loadAppConfig(); // the list of methods refreshes itself
        Alert.alert('Payment method unavailable', `${apiError.message} Please choose another payment method.`);
      } else if (apiError.code === 'PRICING_ERROR') {
        refreshQuote();
        setStep(1);
        Alert.alert("Can't place this order", apiError.message);
      } else if (apiError.isNetworkError && paymentMethod === 'cod') {
        Alert.alert(
          'Connection problem',
          "We couldn't confirm your order. Check your connection and tap Place Order again: your order will not be placed twice."
        );
      } else {
        Alert.alert('Order not placed', apiError.message);
      }
    } finally {
      setPlacing(false);
    }
  };

  // ── Screens ────────────────────────────────────────────────────────────────

  if (pendingPayment) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerBox}>
          <View style={styles.pendingIcon}>
            <Ionicons name="time-outline" size={44} color={Theme.colors.white} />
          </View>
          <Text style={styles.centerTitle}>Payment received</Text>
          <Text style={styles.centerText}>
            {pendingPayment.serverMessage ??
              "Your payment went through, but we couldn't confirm your order yet. It is being confirmed and will appear under My Orders in a few minutes."}
          </Text>
          <Text style={styles.centerText}>
            Please do not pay again. If your order is not under My Orders within a few minutes, contact support with the reference below.
          </Text>
          <Text style={styles.pendingRef}>Payment reference: {pendingPayment.paymentId}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(customer)/orders')}>
            <Text style={styles.primaryBtnText}>View My Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => Linking.openURL(telUrl(support.phone))}>
            <Ionicons name="call-outline" size={16} color={Theme.colors.primary} />
            <Text style={styles.secondaryBtnText}>Call support · {support.phone}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerBox}>
          <Ionicons name="cart-outline" size={72} color={Theme.colors.border} />
          <Text style={styles.centerTitle}>Your cart is empty</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(customer)/home')}>
            <Text style={styles.primaryBtnText}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const summary = (
    <View style={styles.summaryBox}>
      <Text style={styles.summaryTitle}>Order Summary</Text>
      {quote ? (
        <>
          <SummaryRow label="Subtotal" value={formatMoney(quote.subtotal, quote.currency)} />
          {quote.discountAmount > 0 && (
            <SummaryRow
              label={quote.coupon ? `Coupon (${quote.coupon.code})` : 'Discount'}
              value={`− ${formatMoney(quote.discountAmount, quote.currency)}`}
              valueColor={Theme.colors.success}
            />
          )}
          {quote.taxAmount > 0 && (
            <SummaryRow label={`Tax (${quote.taxRatePercent}%)`} value={formatMoney(quote.taxAmount, quote.currency)} />
          )}
          <SummaryRow label="Shipping" value="FREE" valueColor={Theme.colors.success} />
          <View style={styles.summaryDivider} />
          <SummaryRow label="Total" value={formatMoney(quote.totalAmount, quote.currency)} bold />
        </>
      ) : quoteError ? (
        <View>
          <Text style={styles.quoteError}>{quoteError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refreshQuote}>
            <Ionicons name="refresh" size={14} color={Theme.colors.primary} />
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : selectedItems.length === 0 ? (
        <Text style={styles.quoteHint}>Select at least one item to order.</Text>
      ) : (
        <View style={styles.quoteLoading}>
          <ActivityIndicator size="small" color={Theme.colors.primary} />
          <Text style={styles.quoteHint}>Calculating your total…</Text>
        </View>
      )}
    </View>
  );

  const canContinue = !!quote && !quoteLoading && selectedItems.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (step > 0 ? setStep(step - 1) : router.back())}
          style={styles.backBtn}
          disabled={placing}
        >
          <Ionicons name="arrow-back" size={22} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.stepper}>
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, i <= step && styles.stepCircleActive, i < step && styles.stepCircleDone]}>
                {i < step
                  ? <Ionicons name="checkmark" size={14} color={Theme.colors.white} />
                  : <Text style={[styles.stepNum, i <= step && styles.stepNumActive]}>{i + 1}</Text>
                }
              </View>
              <Text style={[styles.stepLabel, i <= step && styles.stepLabelActive]}>{label}</Text>
            </View>
            {i < STEPS.length - 1 && <View style={[styles.stepLine, i < step && styles.stepLineDone]} />}
          </React.Fragment>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* ── STEP 0: Address ── */}
        {step === 0 && (
          <View>
            <Text style={styles.stepTitle}>Delivery Address</Text>

            {addressesLoading ? (
              <ActivityIndicator style={{ marginVertical: Theme.spacing.xxl }} color={Theme.colors.primary} />
            ) : (
              <>
                {addresses.map((address) => {
                  const selected = !showForm && choice?.kind === 'saved' && choice.id === address._id;
                  return (
                    <TouchableOpacity
                      key={address._id}
                      style={[styles.addressCard, selected && styles.addressCardActive]}
                      onPress={() => { setChoice({ kind: 'saved', id: address._id }); setShowForm(false); }}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.payRadio, selected && styles.payRadioActive]}>
                        {selected && <View style={styles.payRadioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.addressCardTop}>
                          <Text style={styles.addressText}>{address.name}</Text>
                          <View style={styles.addressTag}>
                            <Text style={styles.addressTagText}>{address.label}</Text>
                          </View>
                          {address.isDefault && (
                            <View style={[styles.addressTag, styles.addressTagDefault]}>
                              <Text style={[styles.addressTagText, { color: Theme.colors.success }]}>Default</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.addressSub}>
                          {address.street}{'\n'}{address.city}, {address.state} – {address.pincode}{'\n'}{address.phone}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {choice?.kind === 'new' && !showForm && (
                  <View style={[styles.addressCard, styles.addressCardActive]}>
                    <View style={[styles.payRadio, styles.payRadioActive]}><View style={styles.payRadioDot} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addressText}>{choice.address.name}</Text>
                      <Text style={styles.addressSub}>
                        {choice.address.street}{'\n'}{choice.address.city}, {choice.address.state} – {choice.address.pincode}{'\n'}{choice.address.phone}
                      </Text>
                    </View>
                  </View>
                )}

                {!showForm ? (
                  <View style={styles.addressActions}>
                    <TouchableOpacity style={styles.linkBtn} onPress={() => { setShowForm(true); setFormErrors({}); }}>
                      <Ionicons name="add-circle-outline" size={18} color={Theme.colors.primary} />
                      <Text style={styles.linkBtnText}>Add a new address</Text>
                    </TouchableOpacity>
                    {addresses.length > 0 && (
                      <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/(customer)/addresses')}>
                        <Text style={styles.linkBtnText}>Manage addresses</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View style={styles.formCard}>
                    <Text style={styles.formTitle}>New address</Text>
                    <Field label="Full Name *" value={form.name} onChange={(v) => setFormField('name', v)} error={formErrors.name} placeholder="John Doe" />
                    <Field
                      label="Phone Number *" value={form.phone} onChange={(v) => setFormField('phone', v)}
                      error={formErrors.phone} placeholder="10-digit mobile number" keyboardType="phone-pad" maxLength={10}
                    />
                    <Field
                      label="Address *" value={form.street} onChange={(v) => setFormField('street', v)}
                      error={formErrors.street} placeholder="House/flat no., street, area, landmark"
                    />
                    <View style={styles.rowFields}>
                      <View style={{ flex: 1 }}>
                        <Field label="City *" value={form.city} onChange={(v) => setFormField('city', v)} error={formErrors.city} placeholder="Mumbai" />
                      </View>
                      <View style={{ width: Theme.spacing.sm }} />
                      <View style={{ flex: 1 }}>
                        <Field label="State *" value={form.state} onChange={(v) => setFormField('state', v)} error={formErrors.state} placeholder="Maharashtra" />
                      </View>
                    </View>
                    <Field
                      label="PIN Code *" value={form.pincode} onChange={(v) => setFormField('pincode', v)}
                      error={formErrors.pincode} placeholder="6-digit PIN code" keyboardType="number-pad" maxLength={6}
                    />
                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>Save this address for next time</Text>
                      <Switch
                        value={saveForLater}
                        onValueChange={setSaveForLater}
                        trackColor={{ true: Theme.colors.primaryLight, false: Theme.colors.border }}
                        thumbColor={saveForLater ? Theme.colors.primary : Theme.colors.white}
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.nextBtn, savingAddress && { opacity: 0.7 }]}
                      onPress={handleUseNewAddress}
                      disabled={savingAddress}
                    >
                      {savingAddress
                        ? <ActivityIndicator color={Theme.colors.white} size="small" />
                        : <Text style={styles.nextBtnText}>Deliver to this address</Text>
                      }
                    </TouchableOpacity>
                    {(addresses.length > 0 || choice) && (
                      <TouchableOpacity style={styles.cancelFormBtn} onPress={() => setShowForm(false)}>
                        <Text style={styles.linkBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {!showForm && (
                  <TouchableOpacity
                    style={[styles.nextBtn, !deliveryAddress && styles.btnDisabled]}
                    onPress={() => setStep(1)}
                    disabled={!deliveryAddress}
                  >
                    <Text style={styles.nextBtnText}>Continue to Review</Text>
                    <Ionicons name="arrow-forward" size={18} color={Theme.colors.white} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        {/* ── STEP 1: Review ── */}
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>Order Review</Text>

            {deliveryAddress && (
              <View style={styles.summaryCard}>
                <View style={styles.summaryCardHeader}>
                  <Ionicons name="location-outline" size={18} color={Theme.colors.primary} />
                  <Text style={styles.summaryCardTitle}>Delivering to</Text>
                  <TouchableOpacity onPress={() => setStep(0)} style={styles.editBtn}>
                    <Text style={styles.editBtnText}>Change</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.addressText}>{deliveryAddress.name} · {deliveryAddress.phone}</Text>
                <Text style={styles.addressSub}>
                  {deliveryAddress.street}{'\n'}{deliveryAddress.city}, {deliveryAddress.state} – {deliveryAddress.pincode}
                </Text>
              </View>
            )}

            <Text style={styles.reviewItemsTitle}>Items ({selectedItems.length} of {items.length})</Text>
            {items.map((item) => {
              const key = cartItemKey(item);
              const isSelected = selectedKeys.has(key);
              const line = isSelected ? quotedLine(item) : undefined;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.reviewItem, !isSelected && styles.reviewItemUnselected]}
                  onPress={() => toggleItem(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.checkbox}>
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={isSelected ? Theme.colors.primary : Theme.colors.border}
                    />
                  </View>
                  <Image
                    source={item.image ? { uri: item.image } : undefined}
                    style={[styles.reviewItemImg, !isSelected && { opacity: 0.5 }]}
                  />
                  <View style={styles.reviewItemInfo}>
                    <Text style={[styles.reviewItemName, !isSelected && { opacity: 0.5, textDecorationLine: 'line-through' }]}>
                      {item.name}
                    </Text>
                    {item.selectedSize && (
                      <Text style={styles.reviewItemSize}>
                        {item.selectedSize.size} · {item.selectedSize.quantity}{item.selectedSize.unit ?? ''}
                      </Text>
                    )}
                    <Text style={styles.reviewItemVendor}>by {line?.shopName ?? item.shopName ?? 'LinkAndSmile'}</Text>
                  </View>
                  <View style={styles.reviewItemRight}>
                    <Text style={styles.reviewItemQty}>×{item.quantity}</Text>
                    <Text style={styles.reviewItemPrice}>
                      {formatMoney(line ? line.lineTotal : unitPrice(item) * item.quantity)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Coupon */}
            <View style={styles.promoRow}>
              {appliedCoupon ? (
                <View style={styles.promoApplied}>
                  <Ionicons name="checkmark-circle" size={18} color={Theme.colors.success} />
                  <Text style={styles.promoAppliedText}>
                    {appliedCoupon} applied{quote?.coupon ? ` · you save ${formatMoney(quote.coupon.discountAmount, quote.currency)}` : ''}
                  </Text>
                  <TouchableOpacity onPress={handleRemoveCoupon} style={styles.promoRemove}>
                    <Ionicons name="close-circle" size={18} color={Theme.colors.danger} />
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.promoInput}
                    placeholder="Coupon code"
                    placeholderTextColor={Theme.colors.textMuted}
                    value={couponInput}
                    onChangeText={(value) => { setCouponInput(value); setCouponError(null); }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={[styles.promoBtn, (couponBusy || !couponInput.trim() || selectedItems.length === 0) && { opacity: 0.6 }]}
                    onPress={handleApplyCoupon}
                    disabled={couponBusy || !couponInput.trim() || selectedItems.length === 0}
                  >
                    {couponBusy
                      ? <ActivityIndicator size="small" color={Theme.colors.white} />
                      : <Text style={styles.promoBtnText}>Apply</Text>
                    }
                  </TouchableOpacity>
                </>
              )}
            </View>
            {couponError ? <Text style={styles.couponError}>{couponError}</Text> : null}
            {couponNotice ? <Text style={styles.couponNotice}>{couponNotice}</Text> : null}

            {summary}

            <TouchableOpacity
              style={[styles.nextBtn, !canContinue && styles.btnDisabled]}
              onPress={() => setStep(2)}
              disabled={!canContinue}
            >
              <Text style={styles.nextBtnText}>Continue to Payment</Text>
              <Ionicons name="arrow-forward" size={18} color={Theme.colors.white} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 2: Payment ── */}
        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>Payment</Text>

            {methods.length === 0 ? (
              <View style={styles.noticeBox}>
                <Ionicons name="alert-circle-outline" size={18} color={Theme.colors.danger} />
                <Text style={styles.noticeText}>
                  Ordering is temporarily unavailable. Please try again later or contact support at {support.phone}.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.payLabel}>Select payment method</Text>
                {methods.map((method) => {
                  const active = paymentMethod === method.key;
                  return (
                    <TouchableOpacity
                      key={method.key}
                      style={[styles.payOption, active && styles.payOptionActive, !method.usable && styles.payOptionDisabled]}
                      onPress={() => method.usable && setPaymentMethod(method.key)}
                      disabled={!method.usable || placing}
                    >
                      <View style={[styles.payIconBox, active && styles.payIconBoxActive]}>
                        <Ionicons
                          name={method.icon as keyof typeof Ionicons.glyphMap}
                          size={22}
                          color={active ? Theme.colors.white : Theme.colors.textSecondary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.payLabel2, active && styles.payLabel2Active]}>{method.label}</Text>
                        <Text style={styles.paySub}>{method.sub}</Text>
                      </View>
                      <View style={[styles.payRadio, active && styles.payRadioActive]}>
                        {active && <View style={styles.payRadioDot} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {summary}

            <TouchableOpacity
              style={[styles.placeOrderBtn, (placing || !canContinue || !paymentMethod) && { opacity: 0.6 }]}
              onPress={handlePlaceOrder}
              disabled={placing || !canContinue || !paymentMethod}
              activeOpacity={0.85}
            >
              {placing ? (
                <ActivityIndicator color={Theme.colors.white} size="small" />
              ) : (
                <>
                  <Ionicons
                    name={paymentMethod === 'razorpay' ? 'lock-closed-outline' : 'checkmark-circle-outline'}
                    size={20}
                    color={Theme.colors.white}
                  />
                  <Text style={styles.placeOrderText}>
                    {paymentMethod === 'razorpay' ? 'Pay' : 'Place Order'}
                    {quote ? ` · ${formatMoney(quote.totalAmount, quote.currency)}` : ''}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.orderNote}>
              By placing this order you agree to our Terms of Service and Return Policy.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Reusable components ──────────────────────────────────────────

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
}

function Field({ label, value, onChange, error, placeholder, keyboardType, maxLength }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, error ? styles.fieldInputError : null]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Theme.colors.textMuted}
        keyboardType={keyboardType ?? 'default'}
        maxLength={maxLength}
        autoCapitalize="words"
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function SummaryRow({ label, value, bold, valueColor }: { label: string; value: string; bold?: boolean; valueColor?: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.summaryLabelBold]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.summaryValueBold, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.lg, paddingVertical: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },

  stepper: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl, paddingVertical: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight,
  },
  stepItem: { alignItems: 'center', gap: 4 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Theme.colors.surfaceSecondary,
    borderWidth: 2, borderColor: Theme.colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  stepCircleActive: { borderColor: Theme.colors.primary, backgroundColor: Theme.colors.primarySurface },
  stepCircleDone: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  stepNum: { fontSize: 12, fontWeight: '700', color: Theme.colors.textMuted },
  stepNumActive: { color: Theme.colors.primary },
  stepLabel: { fontSize: 11, color: Theme.colors.textMuted, fontWeight: '500' },
  stepLabelActive: { color: Theme.colors.primary, fontWeight: '700' },
  stepLine: { flex: 1, height: 2, backgroundColor: Theme.colors.border, marginBottom: 14 },
  stepLineDone: { backgroundColor: Theme.colors.primary },

  scroll: { flex: 1 },
  scrollContent: { padding: Theme.spacing.lg, paddingBottom: 250 },
  stepTitle: { fontSize: Theme.font.xl, fontWeight: '700', color: Theme.colors.text, marginBottom: Theme.spacing.lg },

  addressCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Theme.spacing.md,
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg, marginBottom: Theme.spacing.sm,
    borderWidth: 1.5, borderColor: Theme.colors.border,
  },
  addressCardActive: { borderColor: Theme.colors.primary, backgroundColor: Theme.colors.primarySurface },
  addressCardTop: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 3 },
  addressTag: {
    backgroundColor: Theme.colors.surfaceSecondary, borderRadius: Theme.radius.sm,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  addressTagDefault: { backgroundColor: Theme.colors.successSurface },
  addressTagText: { fontSize: 10, fontWeight: '700', color: Theme.colors.textSecondary },
  addressActions: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: Theme.spacing.xs, marginBottom: Theme.spacing.sm,
  },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Theme.spacing.sm },
  linkBtnText: { fontSize: Theme.font.sm, color: Theme.colors.primary, fontWeight: '600' },

  formCard: {
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg, marginTop: Theme.spacing.sm,
    borderWidth: 1, borderColor: Theme.colors.border,
  },
  formTitle: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.text, marginBottom: Theme.spacing.md },
  rowFields: { flexDirection: 'row' },
  fieldWrap: { marginBottom: Theme.spacing.md },
  fieldLabel: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.text, marginBottom: 5 },
  fieldInput: {
    borderWidth: 1.5, borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md, paddingHorizontal: Theme.spacing.md,
    height: 48, fontSize: Theme.font.md, color: Theme.colors.text,
    backgroundColor: Theme.colors.surface,
  },
  fieldInputError: { borderColor: Theme.colors.danger, backgroundColor: '#FFF5F3' },
  fieldError: { fontSize: 11, color: Theme.colors.danger, marginTop: 3 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Theme.spacing.xs },
  switchLabel: { fontSize: Theme.font.sm, color: Theme.colors.text, fontWeight: '500' },
  cancelFormBtn: { alignItems: 'center', paddingVertical: Theme.spacing.md },

  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.md,
    height: 52, marginTop: Theme.spacing.lg, ...Theme.shadow.sm,
  },
  nextBtnText: { color: Theme.colors.white, fontSize: Theme.font.md, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },

  summaryCard: {
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg, marginBottom: Theme.spacing.lg,
    borderWidth: 1, borderColor: Theme.colors.border,
  },
  summaryCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Theme.spacing.sm },
  summaryCardTitle: { flex: 1, fontSize: Theme.font.md, fontWeight: '600', color: Theme.colors.text },
  editBtn: { paddingHorizontal: Theme.spacing.sm, paddingVertical: 2 },
  editBtnText: { fontSize: Theme.font.sm, color: Theme.colors.primary, fontWeight: '600' },
  addressText: { fontSize: Theme.font.md, fontWeight: '600', color: Theme.colors.text },
  addressSub: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, lineHeight: 20 },

  reviewItemsTitle: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.text, marginBottom: Theme.spacing.md },
  reviewItem: {
    flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md,
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.md,
    padding: Theme.spacing.md, marginBottom: Theme.spacing.sm,
    borderWidth: 1, borderColor: Theme.colors.borderLight,
  },
  reviewItemUnselected: { opacity: 0.7, backgroundColor: Theme.colors.surfaceSecondary },
  checkbox: { marginRight: 4, alignSelf: 'center' },
  reviewItemImg: { width: 60, height: 60, borderRadius: Theme.radius.sm, backgroundColor: Theme.colors.surfaceSecondary },
  reviewItemInfo: { flex: 1 },
  reviewItemName: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.text, marginBottom: 2 },
  reviewItemSize: { fontSize: 11, color: Theme.colors.primary, marginBottom: 2 },
  reviewItemVendor: { fontSize: 11, color: Theme.colors.textMuted },
  reviewItemRight: { alignItems: 'flex-end', gap: 2 },
  reviewItemQty: { fontSize: Theme.font.sm, color: Theme.colors.textMuted },
  reviewItemPrice: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.primary },

  promoRow: {
    flexDirection: 'row', gap: Theme.spacing.sm,
    marginTop: Theme.spacing.lg, marginBottom: Theme.spacing.sm,
  },
  promoInput: {
    flex: 1, borderWidth: 1.5, borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md, paddingHorizontal: Theme.spacing.md,
    height: 46, fontSize: Theme.font.md, color: Theme.colors.text,
    backgroundColor: Theme.colors.surface, letterSpacing: 1,
  },
  promoBtn: {
    backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.lg, height: 46,
    justifyContent: 'center', alignItems: 'center',
  },
  promoBtnText: { color: Theme.colors.white, fontWeight: '700', fontSize: Theme.font.sm },
  promoApplied: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Theme.colors.successSurface, borderRadius: Theme.radius.md,
    padding: Theme.spacing.md, borderWidth: 1, borderColor: Theme.colors.success,
  },
  promoAppliedText: { flex: 1, fontSize: Theme.font.sm, color: Theme.colors.success, fontWeight: '600' },
  promoRemove: { padding: 2 },
  couponError: { fontSize: 12, color: Theme.colors.danger, marginBottom: Theme.spacing.xs },
  couponNotice: { fontSize: 12, color: Theme.colors.textSecondary, marginBottom: Theme.spacing.xs },

  noticeBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Theme.colors.dangerSurface, borderRadius: Theme.radius.md, padding: Theme.spacing.md,
  },
  noticeText: { flex: 1, fontSize: Theme.font.sm, color: Theme.colors.text, lineHeight: 19 },

  payLabel: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.text, marginBottom: Theme.spacing.md },
  payOption: {
    flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md,
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.md, marginBottom: Theme.spacing.sm,
    borderWidth: 1.5, borderColor: Theme.colors.border,
  },
  payOptionActive: { borderColor: Theme.colors.primary, backgroundColor: Theme.colors.primarySurface },
  payOptionDisabled: { opacity: 0.5 },
  payIconBox: {
    width: 44, height: 44, borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.surfaceSecondary,
    justifyContent: 'center', alignItems: 'center',
  },
  payIconBoxActive: { backgroundColor: Theme.colors.primary },
  payLabel2: { fontSize: Theme.font.md, fontWeight: '600', color: Theme.colors.text },
  payLabel2Active: { color: Theme.colors.primary },
  paySub: { fontSize: Theme.font.xs, color: Theme.colors.textMuted, marginTop: 2 },
  payRadio: {
    width: 20, height: 20, borderRadius: 10, marginTop: 2,
    borderWidth: 2, borderColor: Theme.colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  payRadioActive: { borderColor: Theme.colors.primary },
  payRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Theme.colors.primary },

  summaryBox: {
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg, marginTop: Theme.spacing.lg,
    borderWidth: 1, borderColor: Theme.colors.border,
  },
  summaryTitle: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.text, marginBottom: Theme.spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Theme.spacing.sm },
  summaryLabel: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary },
  summaryLabelBold: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.text },
  summaryValue: { fontSize: Theme.font.sm, color: Theme.colors.text, fontWeight: '500' },
  summaryValueBold: { fontSize: Theme.font.lg, fontWeight: '800', color: Theme.colors.text },
  summaryDivider: { height: 1, backgroundColor: Theme.colors.border, marginVertical: Theme.spacing.sm },
  quoteLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quoteHint: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary },
  quoteError: { fontSize: Theme.font.sm, color: Theme.colors.danger, lineHeight: 19 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Theme.spacing.sm },
  retryBtnText: { fontSize: Theme.font.sm, color: Theme.colors.primary, fontWeight: '600' },

  placeOrderBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.md,
    height: 56, marginTop: Theme.spacing.lg, ...Theme.shadow.md,
  },
  placeOrderText: { color: Theme.colors.white, fontSize: Theme.font.lg, fontWeight: '800' },
  orderNote: { fontSize: 11, color: Theme.colors.textMuted, textAlign: 'center', marginTop: Theme.spacing.md, lineHeight: 16 },

  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: Theme.spacing.xxl },
  centerTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text, textAlign: 'center' },
  centerText: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  pendingIcon: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: Theme.colors.warning,
    justifyContent: 'center', alignItems: 'center', marginBottom: Theme.spacing.sm,
  },
  pendingRef: { fontSize: Theme.font.xs, color: Theme.colors.textMuted },
  primaryBtn: {
    backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.xxl, paddingVertical: Theme.spacing.md, marginTop: Theme.spacing.sm,
  },
  primaryBtnText: { color: Theme.colors.white, fontWeight: '700', fontSize: Theme.font.md },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Theme.spacing.sm },
  secondaryBtnText: { color: Theme.colors.primary, fontWeight: '600', fontSize: Theme.font.sm },
});
