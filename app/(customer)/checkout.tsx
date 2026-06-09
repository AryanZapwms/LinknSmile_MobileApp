// app/(customer)/checkout.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../../store/cart.store';
import { useAuthStore } from '../../store/auth.store';
import { api } from '../../services/api';
import { Theme } from '../../constants/theme';

interface Address {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

const EMPTY_ADDRESS: Address = {
  fullName: '', phone: '', line1: '',
  line2: '', city: '', state: '', pincode: '',
};

const STEPS = ['Address', 'Review', 'Payment'];

export default function CheckoutScreen() {
  const { items, getTotalPrice, clearCart } = useCartStore();
  const { user } = useAuthStore();

  const [step, setStep] = useState(0);
  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
  const [errors, setErrors] = useState<Partial<Address>>({});
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoApplied, setPromoApplied] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online'>('cod');
  const [selectedItemKeys, setSelectedItemKeys] = useState<Set<string>>(new Set());

  const getItemKey = (item: any) => `${item.productId}_${item.selectedSize?.size || ''}_${item.selectedSize?.quantity || ''}`;

  // Initialize selected items (all selected by default)
  useEffect(() => {
    const allKeys = items.map(item => getItemKey(item));
    setSelectedItemKeys(new Set(allKeys));
  }, [items]);

  // Selected items and calculated totals
  const selectedItems = items.filter(item => selectedItemKeys.has(getItemKey(item)));
  const selectedSubtotal = selectedItems.reduce((sum, item) => {
    const price = item.discountPrice ?? item.price;
    return sum + (price * item.quantity);
  }, 0);
  const selectedShipping = selectedSubtotal > 499 ? 0 : 49;
  const selectedDiscount = promoDiscount; // promo applies to selected subtotal (could be limited but simple)
  const selectedTotal = selectedSubtotal + selectedShipping - selectedDiscount;

  const toggleItemSelection = (item: any) => {
    const key = getItemKey(item);
    const newSet = new Set(selectedItemKeys);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedItemKeys(newSet);
  };

  const setField = (field: keyof Address, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  const validateAddress = (): boolean => {
    const newErrors: Partial<Address> = {};
    if (!address.fullName.trim()) newErrors.fullName = 'Required';
    if (!address.phone.trim()) newErrors.phone = 'Required';
    else if (!/^\d{10}$/.test(address.phone.trim())) newErrors.phone = 'Enter valid 10-digit number';
    if (!address.line1.trim()) newErrors.line1 = 'Required';
    if (!address.city.trim()) newErrors.city = 'Required';
    if (!address.state.trim()) newErrors.state = 'Required';
    if (!address.pincode.trim()) newErrors.pincode = 'Required';
    else if (!/^\d{6}$/.test(address.pincode.trim())) newErrors.pincode = 'Enter valid 6-digit pincode';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePromoApply = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const res = await api.get(`/api/promos/${promoCode.trim().toUpperCase()}`);
      const promo = res.data;
      if (promo?.discountType === 'percentage') {
        setPromoDiscount(Math.round((selectedSubtotal * promo.discountValue) / 100));
      } else if (promo?.discountType === 'fixed') {
        setPromoDiscount(Math.min(promo.discountValue, selectedSubtotal));
      }
      setPromoApplied(true);
      Alert.alert('Promo Applied!', `"${promoCode.toUpperCase()}" has been applied.`);
    } catch {
      Alert.alert('Invalid Code', 'This promo code is not valid or has expired.');
      setPromoApplied(false);
      setPromoDiscount(0);
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setPromoCode('');
    setPromoDiscount(0);
    setPromoApplied(false);
  };

  const handlePlaceOrder = async () => {
  if (selectedItems.length === 0) {
    Alert.alert('No items selected', 'Please select at least one item to order.');
    return;
  }

  setPlacingOrder(true);
  try {
   const orderPayload = {
  items: selectedItems.map((item) => ({
    product: item.productId,
    quantity: item.quantity,
    selectedSize: item.selectedSize,
    price: item.discountPrice ?? item.price,
  })),
  shippingAddress: {
    name: address.fullName,
    phone: address.phone,
    addressLine1: address.line1,
    addressLine2: address.line2,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
  },
  paymentMethod,
  totalAmount: selectedTotal,  // ✅ required field
  // optional (backend may ignore but fine to send)
  subtotal: selectedSubtotal,
  shippingCost: selectedShipping,
  discount: selectedDiscount,
  promoCode: promoApplied ? promoCode.toUpperCase() : undefined,
};

    const res = await api.post('/api/orders', orderPayload);
    const orderId = res.data?.order?._id ?? res.data?._id;

    clearCart();
    router.replace(`/(customer)/order-success/${orderId ?? 'success'}`);
  } catch (error: any) {
    const message = error.response?.data?.error
      ?? error.response?.data?.message
      ?? 'Failed to place order. Please try again.';
    Alert.alert('Order Failed', message);
  } finally {
    setPlacingOrder(false);
  }
};

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyBox}>
          <Ionicons name="cart-outline" size={72} color={Theme.colors.border} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.replace('/(customer)/home')}>
            <Text style={styles.emptyBtnText}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 0 ? setStep(step - 1) : router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Step Indicator */}
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
            {i < STEPS.length - 1 && (
              <View style={[styles.stepLine, i < step && styles.stepLineDone]} />
            )}
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

            <Field label="Full Name *" value={address.fullName}
              onChange={(v) => setField('fullName', v)} error={errors.fullName}
              placeholder="John Doe" />
            <Field label="Phone Number *" value={address.phone}
              onChange={(v) => setField('phone', v)} error={errors.phone}
              placeholder="10-digit mobile number" keyboardType="phone-pad" />
            <Field label="Address Line 1 *" value={address.line1}
              onChange={(v) => setField('line1', v)} error={errors.line1}
              placeholder="House/Flat No., Street" />
            <Field label="Address Line 2" value={address.line2}
              onChange={(v) => setField('line2', v)}
              placeholder="Landmark, Area (optional)" />
            <View style={styles.rowFields}>
              <View style={{ flex: 1 }}>
                <Field label="City *" value={address.city}
                  onChange={(v) => setField('city', v)} error={errors.city}
                  placeholder="Mumbai" />
              </View>
              <View style={{ width: Theme.spacing.sm }} />
              <View style={{ flex: 1 }}>
                <Field label="State *" value={address.state}
                  onChange={(v) => setField('state', v)} error={errors.state}
                  placeholder="Maharashtra" />
              </View>
            </View>
            <Field label="Pincode *" value={address.pincode}
              onChange={(v) => setField('pincode', v)} error={errors.pincode}
              placeholder="6-digit pincode" keyboardType="number-pad" maxLength={6} />

            <TouchableOpacity
              style={styles.nextBtn}
              onPress={() => { if (validateAddress()) setStep(1); }}
            >
              <Text style={styles.nextBtnText}>Continue to Review</Text>
              <Ionicons name="arrow-forward" size={18} color={Theme.colors.white} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 1: Review with item selection ── */}
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>Order Review</Text>

            {/* Address Summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryCardHeader}>
                <Ionicons name="location-outline" size={18} color={Theme.colors.primary} />
                <Text style={styles.summaryCardTitle}>Delivering to</Text>
                <TouchableOpacity onPress={() => setStep(0)} style={styles.editBtn}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.addressText}>
                {address.fullName} · {address.phone}
              </Text>
              <Text style={styles.addressSub}>
                {address.line1}{address.line2 ? `, ${address.line2}` : ''}{'\n'}
                {address.city}, {address.state} – {address.pincode}
              </Text>
            </View>

            {/* Items with selection */}
            <Text style={styles.reviewItemsTitle}>
              Items ({selectedItems.length} of {items.length})
            </Text>
            {items.map((item) => {
              const key = getItemKey(item);
              const isSelected = selectedItemKeys.has(key);
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.reviewItem,
                    !isSelected && styles.reviewItemUnselected,
                  ]}
                  onPress={() => toggleItemSelection(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.checkbox}>
                    {isSelected ? (
                      <Ionicons name="checkbox" size={22} color={Theme.colors.primary} />
                    ) : (
                      <Ionicons name="square-outline" size={22} color={Theme.colors.border} />
                    )}
                  </View>
                  <Image
                    source={{ uri: item.image ?? 'https://via.placeholder.com/60' }}
                    style={[styles.reviewItemImg, !isSelected && { opacity: 0.5 }]}
                  />
                  <View style={styles.reviewItemInfo}>
                    <Text style={[styles.reviewItemName, !isSelected && { opacity: 0.5, textDecorationLine: 'line-through' }]}>
                      {item.name}
                    </Text>
                    {item.selectedSize && (
                      <Text style={styles.reviewItemSize}>
                        {item.selectedSize.size} · {item.selectedSize.quantity}{item.selectedSize.unit}
                      </Text>
                    )}
                    <Text style={styles.reviewItemVendor}>by {item.shopName ?? 'LinkAndSmile'}</Text>
                  </View>
                  <View style={styles.reviewItemRight}>
                    <Text style={styles.reviewItemQty}>×{item.quantity}</Text>
                    <Text style={styles.reviewItemPrice}>
                      ₹{((item.discountPrice ?? item.price) * item.quantity).toFixed(0)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Promo */}
            <View style={styles.promoRow}>
              {promoApplied ? (
                <View style={styles.promoApplied}>
                  <Ionicons name="checkmark-circle" size={18} color={Theme.colors.success} />
                  <Text style={styles.promoAppliedText}>"{promoCode.toUpperCase()}" applied</Text>
                  <TouchableOpacity onPress={handleRemovePromo} style={styles.promoRemove}>
                    <Ionicons name="close-circle" size={18} color={Theme.colors.danger} />
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.promoInput}
                    placeholder="Promo code"
                    placeholderTextColor={Theme.colors.textMuted}
                    value={promoCode}
                    onChangeText={setPromoCode}
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity
                    style={[styles.promoBtn, promoLoading && { opacity: 0.7 }]}
                    onPress={handlePromoApply}
                    disabled={promoLoading}
                  >
                    {promoLoading
                      ? <ActivityIndicator size="small" color={Theme.colors.white} />
                      : <Text style={styles.promoBtnText}>Apply</Text>
                    }
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Order Summary with selected totals */}
            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>Order Summary</Text>
              <SummaryRow label="Subtotal" value={`₹${selectedSubtotal.toFixed(0)}`} />
              <SummaryRow label="Shipping" value={selectedShipping === 0 ? 'FREE' : `₹${selectedShipping}`} valueColor={selectedShipping === 0 ? Theme.colors.success : undefined} />
              {selectedDiscount > 0 && <SummaryRow label="Discount" value={`−₹${selectedDiscount}`} valueColor={Theme.colors.success} />}
              <View style={styles.summaryDivider} />
              <SummaryRow label="Total" value={`₹${selectedTotal.toFixed(0)}`} bold />
            </View>

            <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(2)}>
              <Text style={styles.nextBtnText}>Continue to Payment</Text>
              <Ionicons name="arrow-forward" size={18} color={Theme.colors.white} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 2: Payment ── */}
        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>Payment</Text>

            <Text style={styles.payLabel}>Select payment method</Text>
            {[
              { key: 'cod', icon: 'cash-outline', label: 'Cash on Delivery', sub: 'Pay when you receive your order' },
              { key: 'online', icon: 'card-outline', label: 'Online Payment', sub: 'UPI, Cards, Net Banking (coming soon)', disabled: true },
            ].map((method) => (
              <TouchableOpacity
                key={method.key}
                style={[
                  styles.payOption,
                  paymentMethod === method.key && styles.payOptionActive,
                  method.disabled && styles.payOptionDisabled,
                ]}
                onPress={() => !method.disabled && setPaymentMethod(method.key as any)}
                disabled={method.disabled}
              >
                <View style={[styles.payIconBox, paymentMethod === method.key && styles.payIconBoxActive]}>
                  <Ionicons
                    name={method.icon as any}
                    size={22}
                    color={paymentMethod === method.key ? Theme.colors.white : Theme.colors.textSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.payLabel2, paymentMethod === method.key && styles.payLabel2Active]}>
                    {method.label}
                  </Text>
                  <Text style={styles.paySub}>{method.sub}</Text>
                </View>
                <View style={[styles.payRadio, paymentMethod === method.key && styles.payRadioActive]}>
                  {paymentMethod === method.key && <View style={styles.payRadioDot} />}
                </View>
              </TouchableOpacity>
            ))}

            {/* Order Summary using selected totals */}
            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>Order Summary</Text>
              <SummaryRow label="Subtotal" value={`₹${selectedSubtotal.toFixed(0)}`} />
              <SummaryRow label="Shipping" value={selectedShipping === 0 ? 'FREE' : `₹${selectedShipping}`} valueColor={selectedShipping === 0 ? Theme.colors.success : undefined} />
              {selectedDiscount > 0 && <SummaryRow label="Discount" value={`−₹${selectedDiscount}`} valueColor={Theme.colors.success} />}
              <View style={styles.summaryDivider} />
              <SummaryRow label="Total" value={`₹${selectedTotal.toFixed(0)}`} bold />
            </View>

            {selectedShipping === 0 && (
              <View style={styles.freeShippingNote}>
                <Ionicons name="gift-outline" size={15} color={Theme.colors.success} />
                <Text style={styles.freeShippingText}>You qualify for free shipping!</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.placeOrderBtn, placingOrder && { opacity: 0.7 }]}
              onPress={handlePlaceOrder}
              disabled={placingOrder}
              activeOpacity={0.85}
            >
              {placingOrder
                ? <ActivityIndicator color={Theme.colors.white} size="small" />
                : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color={Theme.colors.white} />
                    <Text style={styles.placeOrderText}>Place Order · ₹{selectedTotal.toFixed(0)}</Text>
                  </>
                )
              }
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

function Field({ label, value, onChange, error, placeholder, keyboardType, maxLength }: any) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, error && styles.fieldInputError]}
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

  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.md,
    height: 52, marginTop: Theme.spacing.lg, ...Theme.shadow.sm,
  },
  nextBtnText: { color: Theme.colors.white, fontSize: Theme.font.md, fontWeight: '700' },

  summaryCard: {
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg, marginBottom: Theme.spacing.lg,
    borderWidth: 1, borderColor: Theme.colors.border,
  },
  summaryCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Theme.spacing.sm },
  summaryCardTitle: { flex: 1, fontSize: Theme.font.md, fontWeight: '600', color: Theme.colors.text },
  editBtn: { paddingHorizontal: Theme.spacing.sm, paddingVertical: 2 },
  editBtnText: { fontSize: Theme.font.sm, color: Theme.colors.primary, fontWeight: '600' },
  addressText: { fontSize: Theme.font.md, fontWeight: '600', color: Theme.colors.text, marginBottom: 3 },
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
    width: 20, height: 20, borderRadius: 10,
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

  freeShippingNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: Theme.spacing.sm,
    backgroundColor: Theme.colors.successSurface, borderRadius: Theme.radius.md,
    padding: Theme.spacing.md, borderWidth: 1, borderColor: Theme.colors.success,
  },
  freeShippingText: { fontSize: Theme.font.sm, color: Theme.colors.success, fontWeight: '600' },

  placeOrderBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.md,
    height: 56, marginTop: Theme.spacing.lg, ...Theme.shadow.md,
  },
  placeOrderText: { color: Theme.colors.white, fontSize: Theme.font.lg, fontWeight: '800' },
  orderNote: { fontSize: 11, color: Theme.colors.textMuted, textAlign: 'center', marginTop: Theme.spacing.md, lineHeight: 16 },

  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  emptyTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },
  emptyBtn: {
    backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.xxl, paddingVertical: Theme.spacing.md,
  },
  emptyBtnText: { color: Theme.colors.white, fontWeight: '700', fontSize: Theme.font.md },
});