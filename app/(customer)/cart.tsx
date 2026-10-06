// app/(customer)/cart.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, ActivityIndicator, Modal, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth.store';
import { telUrl, useSupportContacts } from '../../store/app-config.store';
import { cartItemKey, MAX_CART_UNITS, unitPrice, useCartStore, type CartItem } from '../../store/cart.store';
import { Theme } from '../../constants/theme';

export default function CartScreen() {
  const { items, removeItem, updateQuantity, getTotalPrice, getTotalItems, clearCart, isLoading, loadCart } = useCartStore();
  const [showBulkModal, setShowBulkModal] = useState(false);
  const isLoggedIn = useAuthStore((s) => !!s.user);
  const support = useSupportContacts();

  useEffect(() => {
    if (isLoggedIn) void loadCart();
  }, [isLoggedIn, loadCart]);

  const handleUpdateQuantity = (item: CartItem, newQty: number) => {
    if (newQty > item.quantity && getTotalItems() >= MAX_CART_UNITS) { setShowBulkModal(true); return; }
    updateQuantity(cartItemKey(item), newQty);
  };

  const handleRemove = (item: CartItem) => {
    Alert.alert('Remove Item', `Remove ${item.name} from cart?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeItem(cartItemKey(item)) },
    ]);
  };

  const handleCheckout = async () => {
    if (!isLoggedIn) {
      Alert.alert('Login Required', 'Please login to checkout', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => router.push('/auth/login') },
      ]);
      return;
    }
    // `only: ''` clears a selection left over from an earlier "Buy Now"
    // (tab screens keep their previous params).
    router.push({ pathname: '/(customer)/checkout', params: { only: '' } });
  };

  const totalPrice = getTotalPrice();
  const totalItems = getTotalItems();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loaderText}>Loading cart...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Shopping Cart</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.emptyBox}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="cart-outline" size={52} color={Theme.colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySub}>Add items to get started</Text>
          <TouchableOpacity style={styles.shopBtn} onPress={() => router.push('/(customer)/home')}>
            <Text style={styles.shopBtnText}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cart ({totalItems})</Text>
        <TouchableOpacity
          onPress={() => Alert.alert('Clear Cart', 'Remove all items?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: clearCart },
          ])}
          style={styles.clearBtn}
        >
          <Ionicons name="trash-outline" size={20} color={Theme.colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {items.map((item) => (
          <View key={cartItemKey(item)} style={styles.cartItem}>
            <Image source={item.image ? { uri: item.image } : undefined} style={styles.itemImg} />
            <View style={styles.itemDetails}>
              <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.itemShop}>by {item.shopName ?? 'LinkAndSmile'}</Text>
              {item.selectedSize && (
                <Text style={styles.itemSize}>
                  {item.selectedSize.size} · {item.selectedSize.quantity}{item.selectedSize.unit ?? ''}
                </Text>
              )}
              <View style={styles.itemBottom}>
                <View style={styles.qtySelector}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => handleUpdateQuantity(item, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                  >
                    <Ionicons name="remove" size={16} color={item.quantity <= 1 ? Theme.colors.border : Theme.colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => handleUpdateQuantity(item, item.quantity + 1)}
                    disabled={item.quantity >= item.stock}
                  >
                    <Ionicons name="add" size={16} color={item.quantity >= item.stock ? Theme.colors.border : Theme.colors.text} />
                  </TouchableOpacity>
                </View>
                <View>
                  <Text style={styles.itemPrice}>
                    ₹{(unitPrice(item) * item.quantity).toFixed(0)}
                  </Text>
                  <Text style={styles.itemUnitPrice}>₹{unitPrice(item)} each</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(item)}>
              <Ionicons name="close" size={18} color={Theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
        ))}
        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.summaryRows}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryVal}>₹{totalPrice.toFixed(0)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Shipping</Text>
            <Text style={[styles.summaryVal, { color: Theme.colors.success }]}>FREE</Text>
          </View>
          {/* The exact amount (coupons, taxes) is priced by the server at checkout. */}
          <Text style={styles.summaryNote}>Taxes and coupons are applied at checkout.</Text>
        </View>
        <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout} activeOpacity={0.85}>
          <Ionicons name="lock-closed-outline" size={18} color={Theme.colors.white} />
          <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.continueBtn} onPress={() => router.push('/(customer)/home')}>
          <Text style={styles.continueBtnText}>Continue Shopping</Text>
        </TouchableOpacity>
      </View>

      {/* Bulk Order Modal */}
      <Modal visible={showBulkModal} transparent animationType="slide" onRequestClose={() => setShowBulkModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="bulb-outline" size={32} color={Theme.colors.warning} />
            </View>
            <Text style={styles.modalTitle}>Need a bulk order?</Text>
            <Text style={styles.modalSub}>
              You&apos;ve reached the {MAX_CART_UNITS}-item limit. Contact our team for bulk pricing and dedicated service.
            </Text>
            <TouchableOpacity style={styles.modalCallBtn} onPress={() => Linking.openURL(telUrl(support.phone))}>
              <Ionicons name="call-outline" size={18} color={Theme.colors.white} />
              <Text style={styles.modalCallText}>Call {support.phone}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalDismiss} onPress={() => setShowBulkModal(false)}>
              <Text style={styles.modalDismissText}>Continue Shopping</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  loaderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loaderText: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.lg, paddingVertical: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },
  clearBtn: { padding: 4 },

  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Theme.spacing.md },
  emptyIconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Theme.colors.primarySurface,
    justifyContent: 'center', alignItems: 'center', marginBottom: Theme.spacing.sm,
  },
  emptyTitle: { fontSize: Theme.font.xl, fontWeight: '700', color: Theme.colors.text },
  emptySub: { fontSize: Theme.font.sm, color: Theme.colors.textMuted },
  shopBtn: {
    marginTop: Theme.spacing.sm, backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.md, paddingHorizontal: Theme.spacing.xxl, paddingVertical: Theme.spacing.md,
  },
  shopBtnText: { color: Theme.colors.white, fontWeight: '700', fontSize: Theme.font.md },

  scroll: { flex: 1 },
  cartItem: {
    flexDirection: 'row', backgroundColor: Theme.colors.surface,
    marginHorizontal: Theme.spacing.lg, marginTop: Theme.spacing.md,
    borderRadius: Theme.radius.lg, padding: Theme.spacing.md,
    ...Theme.shadow.sm, borderWidth: 1, borderColor: Theme.colors.borderLight,
  },
  itemImg: { width: 80, height: 80, borderRadius: Theme.radius.md, backgroundColor: Theme.colors.surfaceSecondary },
  itemDetails: { flex: 1, marginLeft: Theme.spacing.md },
  itemName: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.text, marginBottom: 2 },
  itemShop: { fontSize: 11, color: Theme.colors.textMuted, marginBottom: 2 },
  itemSize: { fontSize: 11, color: Theme.colors.primary, marginBottom: 6 },
  itemBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  qtySelector: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Theme.colors.border, borderRadius: Theme.radius.sm, overflow: 'hidden',
  },
  qtyBtn: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.surfaceSecondary },
  qtyText: { width: 32, textAlign: 'center', fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.text },
  itemPrice: { fontSize: Theme.font.md, fontWeight: '800', color: Theme.colors.primary, textAlign: 'right' },
  itemUnitPrice: { fontSize: 10, color: Theme.colors.textMuted, textAlign: 'right' },
  removeBtn: { padding: 4, marginLeft: 4 },

  bottomBar: {
    backgroundColor: Theme.colors.surface, borderTopWidth: 1,
    borderTopColor: Theme.colors.borderLight, padding: Theme.spacing.lg,
  },
  summaryRows: { marginBottom: Theme.spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary },
  summaryVal: { fontSize: Theme.font.sm, fontWeight: '500', color: Theme.colors.text },
  summaryNote: { fontSize: Theme.font.xs, color: Theme.colors.textMuted, marginTop: 2 },

  checkoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.md,
    height: 52, marginBottom: Theme.spacing.sm, ...Theme.shadow.sm,
  },
  checkoutBtnText: { color: Theme.colors.white, fontSize: Theme.font.md, fontWeight: '700' },
  continueBtn: {
    borderRadius: Theme.radius.md, height: 46,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Theme.colors.primary,
  },
  continueBtnText: { color: Theme.colors.primary, fontSize: Theme.font.md, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: Theme.colors.surface, borderTopLeftRadius: Theme.radius.xl,
    borderTopRightRadius: Theme.radius.xl, padding: Theme.spacing.xxl,
    alignItems: 'center', gap: Theme.spacing.md,
  },
  modalIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Theme.colors.warningSurface,
    justifyContent: 'center', alignItems: 'center',
  },
  modalTitle: { fontSize: Theme.font.xl, fontWeight: '800', color: Theme.colors.text },
  modalSub: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  modalCallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.md,
    paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.xxl, width: '100%', justifyContent: 'center',
  },
  modalCallText: { color: Theme.colors.white, fontWeight: '700', fontSize: Theme.font.md },
  modalDismiss: { paddingVertical: Theme.spacing.sm },
  modalDismissText: { color: Theme.colors.textSecondary, fontSize: Theme.font.sm, fontWeight: '500' },
});