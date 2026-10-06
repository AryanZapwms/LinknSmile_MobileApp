// app/(vendor)/orders.tsx
// FIXES:
// 1. Per-order updating state so spinner only shows on the tapped order
// 2. Cancellation reason input before cancelling
// 3. Recent orders status key fixed (orderStatus not status)

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Alert, RefreshControl, ActivityIndicator, Modal,
  ScrollView, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { Theme } from '../../constants/theme';
import { withSellingGate } from '../../components/vendor/SellingGate';

interface VendorOrder {
  _id: string;
  orderNumber?: string;
  status: string;
  paymentMethod: string;
  createdAt: string;
  total: number;
  customer?: { name?: string; email?: string };
  items: { productId: string; name: string; image?: string; price: number; quantity: number }[];
  shippingAddress?: { name?: string; phone?: string; street?: string; city?: string; state?: string; zipCode?: string };
  cancellationReason?: string;
}

type StatusFilter = 'all' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_META: Record<string, { color: string; bg: string; icon: string }> = {
  pending:    { color: '#D97706', bg: '#FFF9EC', icon: 'time-outline' },
  processing: { color: Theme.colors.primary, bg: Theme.colors.primarySurface, icon: 'construct-outline' },
  shipped:    { color: '#2563EB', bg: '#EFF6FF', icon: 'car-outline' },
  delivered:  { color: Theme.colors.success, bg: Theme.colors.successSurface, icon: 'checkmark-circle-outline' },
  cancelled:  { color: Theme.colors.danger, bg: Theme.colors.dangerSurface, icon: 'close-circle-outline' },
};

const NEXT_STATUS: Record<string, string> = {
  pending: 'processing',
  processing: 'shipped',
  shipped: 'delivered',
};

function VendorOrdersScreen() {
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<StatusFilter>('all');
  const [selectedOrder, setSelectedOrder] = useState<VendorOrder | null>(null);
  // Per-order updating state (keyed by order _id)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Cancellation state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<VendorOrder | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.get('/api/vendor/orders');
      const rawOrders = res.data?.orders ?? res.data ?? [];
      const mappedOrders = (Array.isArray(rawOrders) ? rawOrders : []).map((order: any) => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        // Backend returns orderStatus — map to status for local use
        status: order.orderStatus ?? order.status,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        total: order.vendorSubtotal ?? order.vendorEarnings ?? 0,
        customer: order.user ? { name: order.user.name, email: order.user.email } : undefined,
        shippingAddress: order.shippingAddress,
        cancellationReason: order.cancellationReason,
        items: (order.items || []).map((item: any) => ({
          productId: item.product?._id || item.productId,
          name: item.product?.name || item.name || 'Product',
          image: item.product?.image || item.image,
          price: item.selectedSize?.price ?? item.price ?? 0,
          quantity: item.quantity,
        })),
      }));
      setOrders(mappedOrders);
    } catch (err) {
      console.error('fetchVendorOrders:', err);
      Alert.alert('Error', 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, []);

  const doUpdateStatus = async (order: VendorOrder, newStatus: string, reason?: string) => {
    setUpdatingOrderId(order._id);
    try {
      const body: Record<string, string> = { orderStatus: newStatus };
      if (reason) body.cancellationReason = reason;

      await api.patch(`/api/vendor/orders/${order._id}`, body);

      // Update local state
      setOrders((prev) =>
        prev.map((o) =>
          o._id === order._id
            ? { ...o, status: newStatus, cancellationReason: reason || o.cancellationReason }
            : o
        )
      );
      if (selectedOrder?._id === order._id) {
        setSelectedOrder((prev) =>
          prev ? { ...prev, status: newStatus, cancellationReason: reason || prev.cancellationReason } : null
        );
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to update order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleUpdateStatus = (order: VendorOrder, newStatus: string) => {
    Alert.alert(
      'Update Status',
      `Mark order as "${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => doUpdateStatus(order, newStatus) },
      ]
    );
  };

  const handleCancelPress = (order: VendorOrder) => {
    setCancelTarget(order);
    setCancellationReason('');
    setShowCancelModal(true);
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    if (!cancellationReason.trim()) {
      Alert.alert('Required', 'Please provide a reason for cancellation');
      return;
    }
    setShowCancelModal(false);
    await doUpdateStatus(cancelTarget, 'cancelled', cancellationReason.trim());
    setCancelTarget(null);
    setCancellationReason('');
    // Close modal if viewing this order
    if (selectedOrder?._id === cancelTarget._id) {
      setSelectedOrder(null);
    }
  };

  const filtered = activeTab === 'all'
    ? orders
    : orders.filter((o) => o.status?.toLowerCase() === activeTab);

  const isOrderUpdating = (id: string) => updatingOrderId === id;

  const renderOrder = ({ item }: { item: VendorOrder }) => {
    const meta = STATUS_META[item.status?.toLowerCase()] ?? STATUS_META.pending;
    const nextStatus = NEXT_STATUS[item.status?.toLowerCase()];
    const date = new Date(item.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
    const isUpdating = isOrderUpdating(item._id);

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => setSelectedOrder(item)}
        activeOpacity={0.88}
      >
        <View style={styles.orderTop}>
          <View>
            <Text style={styles.orderNum}>#{item.orderNumber ?? item._id.slice(-8).toUpperCase()}</Text>
            <Text style={styles.orderDate}>{date}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon as any} size={12} color={meta.color} />
            <Text style={[styles.statusText, { color: meta.color }]}>
              {item.status?.charAt(0).toUpperCase() + item.status?.slice(1)}
            </Text>
          </View>
        </View>

        {item.customer?.name && (
          <View style={styles.customerRow}>
            <Ionicons name="person-outline" size={13} color={Theme.colors.textMuted} />
            <Text style={styles.customerName}>{item.customer.name}</Text>
          </View>
        )}

        <View style={styles.itemsPreview}>
          {item.items?.[0]?.image && (
            <Image source={{ uri: item.items[0].image }} style={styles.itemThumb} />
          )}
          <Text style={styles.itemsText} numberOfLines={1}>
            {item.items?.[0]?.name ?? 'Item'}
            {item.items?.length > 1 ? ` +${item.items.length - 1} more` : ''}
          </Text>
        </View>

        <View style={styles.orderBottom}>
          <Text style={styles.orderTotal}>₹{item.total?.toFixed(0) ?? 0}</Text>
          <View style={styles.actionRow}>
            {nextStatus && (
              <TouchableOpacity
                style={[styles.nextStatusBtn, isUpdating && styles.btnDisabled]}
                onPress={() => handleUpdateStatus(item, nextStatus)}
                disabled={isUpdating}
              >
                {isUpdating
                  ? <ActivityIndicator size="small" color={Theme.colors.white} />
                  : <Text style={styles.nextStatusText}>
                      Mark {nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}
                    </Text>
                }
              </TouchableOpacity>
            )}
            {item.status?.toLowerCase() !== 'cancelled' &&
              item.status?.toLowerCase() !== 'delivered' && (
              <TouchableOpacity
                style={[styles.cancelBtn, isUpdating && styles.btnDisabled]}
                onPress={() => handleCancelPress(item)}
                disabled={isUpdating}
              >
                <Ionicons name="close-circle-outline" size={16} color={Theme.colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {item.status?.toLowerCase() === 'cancelled' && item.cancellationReason && (
          <View style={styles.cancelReasonBanner}>
            <Ionicons name="information-circle-outline" size={13} color={Theme.colors.danger} />
            <Text style={styles.cancelReasonText} numberOfLines={2}>
              Reason: {item.cancellationReason}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders</Text>
        {orders.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{orders.length}</Text>
          </View>
        )}
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={STATUS_TABS}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.tabsRow}
        renderItem={({ item: tab }) => {
          const count = tab.key === 'all'
            ? orders.length
            : orders.filter((o) => o.status?.toLowerCase() === tab.key).length;
          return (
            <TouchableOpacity
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {count > 0 && (
                <View style={[styles.tabBadge, activeTab === tab.key && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, activeTab === tab.key && styles.tabBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          renderItem={renderOrder}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchOrders(); }}
              tintColor={Theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="receipt-outline" size={64} color={Theme.colors.border} />
              <Text style={styles.emptyTitle}>
                No {activeTab === 'all' ? '' : activeTab} orders
              </Text>
              <Text style={styles.emptySub}>
                Orders will appear here once customers start buying
              </Text>
            </View>
          }
        />
      )}

      {/* ── Cancellation Reason Modal ── */}
      <Modal
        visible={showCancelModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCancelModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.cancelOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.cancelSheet}>
            <View style={styles.cancelSheetHandle} />
            <Text style={styles.cancelSheetTitle}>Cancel Order</Text>
            <Text style={styles.cancelSheetSub}>
              Please provide a reason. The customer will be notified and their payment will be refunded.
            </Text>
            <TextInput
              style={styles.cancelReasonInput}
              placeholder="e.g. Item out of stock, unable to fulfil this order..."
              placeholderTextColor={Theme.colors.textMuted}
              value={cancellationReason}
              onChangeText={setCancellationReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.cancelSheetActions}>
              <TouchableOpacity
                style={styles.cancelSheetDismiss}
                onPress={() => { setShowCancelModal(false); setCancelTarget(null); }}
              >
                <Text style={styles.cancelSheetDismissText}>Keep Order</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.cancelSheetConfirm,
                  !cancellationReason.trim() && styles.btnDisabled,
                ]}
                onPress={handleCancelConfirm}
                disabled={!cancellationReason.trim()}
              >
                <Text style={styles.cancelSheetConfirmText}>Cancel Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Order Detail Modal ── */}
      <Modal
        visible={!!selectedOrder}
        animationType="slide"
        onRequestClose={() => setSelectedOrder(null)}
      >
        {selectedOrder && (
          <SafeAreaView style={styles.safe}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedOrder(null)} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={22} color={Theme.colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Order Details</Text>
              <View style={{ width: 32 }} />
            </View>
            <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {(() => {
                const meta = STATUS_META[selectedOrder.status?.toLowerCase()] ?? STATUS_META.pending;
                const nextStatus = NEXT_STATUS[selectedOrder.status?.toLowerCase()];
                const date = new Date(selectedOrder.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'long', year: 'numeric',
                });
                const isUpdating = isOrderUpdating(selectedOrder._id);

                return (
                  <>
                    <View style={[styles.modalStatusBanner, { backgroundColor: meta.bg }]}>
                      <View style={[styles.modalStatusIcon, { backgroundColor: meta.color }]}>
                        <Ionicons name={meta.icon as any} size={22} color={Theme.colors.white} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.modalStatusLabel, { color: meta.color }]}>
                          {selectedOrder.status?.charAt(0).toUpperCase() + selectedOrder.status?.slice(1)}
                        </Text>
                        <Text style={styles.modalStatusDate}>{date}</Text>
                        <Text style={styles.modalStatusNum}>
                          #{selectedOrder.orderNumber ?? selectedOrder._id.slice(-8).toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    {/* Cancellation reason banner */}
                    {selectedOrder.status?.toLowerCase() === 'cancelled' && selectedOrder.cancellationReason && (
                      <View style={styles.canceledBanner}>
                        <Ionicons name="information-circle-outline" size={16} color={Theme.colors.danger} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.canceledBannerTitle}>Cancellation Reason</Text>
                          <Text style={styles.canceledBannerText}>{selectedOrder.cancellationReason}</Text>
                          <Text style={styles.canceledBannerRefund}>
                            Customer's payment will be refunded within 5–7 business days.
                          </Text>
                        </View>
                      </View>
                    )}

                    <View style={styles.detailCard}>
                      <Text style={styles.detailCardTitle}>Items</Text>
                      {selectedOrder.items.map((item, i) => (
                        <View
                          key={i}
                          style={[
                            styles.detailItemRow,
                            i < selectedOrder.items.length - 1 && styles.detailItemBorder,
                          ]}
                        >
                          {item.image && (
                            <Image source={{ uri: item.image }} style={styles.detailItemImg} />
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.detailItemName} numberOfLines={2}>{item.name}</Text>
                            <Text style={styles.detailItemQty}>Qty: {item.quantity}</Text>
                          </View>
                          <Text style={styles.detailItemPrice}>
                            ₹{(item.price * item.quantity).toFixed(0)}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {selectedOrder.shippingAddress && (
                      <View style={styles.detailCard}>
                        <Text style={styles.detailCardTitle}>Delivery Address</Text>
                        <Text style={styles.addrName}>{selectedOrder.shippingAddress.name}</Text>
                        {selectedOrder.shippingAddress.phone && (
                          <Text style={styles.addrPhone}>{selectedOrder.shippingAddress.phone}</Text>
                        )}
                        <Text style={styles.addrLine}>
                          {[
                            selectedOrder.shippingAddress.street,
                            selectedOrder.shippingAddress.city,
                            selectedOrder.shippingAddress.state,
                            selectedOrder.shippingAddress.zipCode,
                          ].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                    )}

                    <View style={styles.detailCard}>
                      <View style={styles.detailTotalRow}>
                        <Text style={styles.detailTotalLabel}>Order Total</Text>
                        <Text style={styles.detailTotalValue}>
                          ₹{selectedOrder.total?.toFixed(0) ?? 0}
                        </Text>
                      </View>
                      <View style={styles.detailPayRow}>
                        <Ionicons
                          name={selectedOrder.paymentMethod === 'cod' ? 'cash-outline' : 'card-outline'}
                          size={14}
                          color={Theme.colors.textMuted}
                        />
                        <Text style={styles.detailPayText}>
                          {selectedOrder.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}
                        </Text>
                      </View>
                    </View>

                    {nextStatus && (
                      <TouchableOpacity
                        style={[styles.updateStatusBtn, isUpdating && styles.btnDisabled]}
                        onPress={() => handleUpdateStatus(selectedOrder, nextStatus)}
                        disabled={isUpdating}
                      >
                        {isUpdating
                          ? <ActivityIndicator color={Theme.colors.white} size="small" />
                          : (
                            <>
                              <Ionicons
                                name="arrow-forward-circle-outline"
                                size={20}
                                color={Theme.colors.white}
                              />
                              <Text style={styles.updateStatusText}>
                                Mark as {nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}
                              </Text>
                            </>
                          )
                        }
                      </TouchableOpacity>
                    )}

                    {selectedOrder.status?.toLowerCase() !== 'cancelled' &&
                      selectedOrder.status?.toLowerCase() !== 'delivered' && (
                      <TouchableOpacity
                        style={[styles.cancelOrderBtn, isUpdating && styles.btnDisabled]}
                        onPress={() => handleCancelPress(selectedOrder)}
                        disabled={isUpdating}
                      >
                        <Text style={styles.cancelOrderText}>Cancel Order</Text>
                      </TouchableOpacity>
                    )}
                  </>
                );
              })()}
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg, paddingVertical: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight,
  },
  headerTitle: { fontSize: Theme.font.xl, fontWeight: '800', color: Theme.colors.text },
  countBadge: {
    backgroundColor: Theme.colors.primarySurface, borderRadius: Theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: Theme.colors.primaryLight,
  },
  countBadgeText: { fontSize: Theme.font.sm, color: Theme.colors.primary, fontWeight: '700' },

  tabsRow: { height: 60, gap: 10, margin: 10, alignItems: 'center' },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Theme.spacing.xl, paddingVertical: 10,
    borderRadius: Theme.radius.full, borderWidth: 1.5, borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
  },
  tabActive: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  tabText: { fontSize: Theme.font.sm, fontWeight: '500', color: Theme.colors.textSecondary },
  tabTextActive: { color: Theme.colors.white, fontWeight: '700' },
  tabBadge: {
    backgroundColor: Theme.colors.surfaceSecondary, borderRadius: Theme.radius.full,
    minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabBadgeText: { fontSize: 10, color: Theme.colors.textSecondary, fontWeight: '700' },
  tabBadgeTextActive: { color: Theme.colors.white },

  loaderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: Theme.spacing.lg, paddingBottom: 32 },

  orderCard: {
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg, marginBottom: Theme.spacing.md,
    borderWidth: 1, borderColor: Theme.colors.borderLight, ...Theme.shadow.sm,
  },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Theme.spacing.sm },
  orderNum: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.text },
  orderDate: { fontSize: Theme.font.xs, color: Theme.colors.textMuted, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Theme.radius.full,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  customerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginBottom: Theme.spacing.sm,
  },
  customerName: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary },
  itemsPreview: {
    flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.sm,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: Theme.colors.borderLight,
    marginBottom: Theme.spacing.md,
  },
  itemThumb: {
    width: 40, height: 40, borderRadius: Theme.radius.sm,
    backgroundColor: Theme.colors.surfaceSecondary,
  },
  itemsText: { flex: 1, fontSize: Theme.font.sm, color: Theme.colors.text },
  orderBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderTotal: { fontSize: Theme.font.lg, fontWeight: '800', color: Theme.colors.text },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nextStatusBtn: {
    backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md, paddingVertical: 8,
    alignItems: 'center', minWidth: 80,
  },
  nextStatusText: { color: Theme.colors.white, fontSize: 12, fontWeight: '700' },
  cancelBtn: {
    width: 34, height: 34, borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.dangerSurface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Theme.colors.danger + '40',
  },
  btnDisabled: { opacity: 0.5 },
  cancelReasonBanner: {
    flexDirection: 'row', gap: 6, alignItems: 'flex-start',
    marginTop: Theme.spacing.sm, padding: Theme.spacing.sm,
    backgroundColor: Theme.colors.dangerSurface,
    borderRadius: Theme.radius.sm,
    borderWidth: 1, borderColor: Theme.colors.danger + '30',
  },
  cancelReasonText: { flex: 1, fontSize: 11, color: Theme.colors.danger },

  emptyBox: { flex: 1, alignItems: 'center', paddingTop: 80, gap: Theme.spacing.sm },
  emptyTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text, marginTop: 8 },
  emptySub: {
    fontSize: Theme.font.sm, color: Theme.colors.textMuted,
    textAlign: 'center', paddingHorizontal: 32,
  },

  // Cancel bottom sheet
  cancelOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  cancelSheet: {
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: Theme.radius.xl, borderTopRightRadius: Theme.radius.xl,
    padding: Theme.spacing.xl, paddingBottom: 36,
  },
  cancelSheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Theme.colors.border,
    alignSelf: 'center', marginBottom: Theme.spacing.lg,
  },
  cancelSheetTitle: { fontSize: Theme.font.xl, fontWeight: '800', color: Theme.colors.danger, marginBottom: 6 },
  cancelSheetSub: {
    fontSize: Theme.font.sm, color: Theme.colors.textSecondary,
    lineHeight: 20, marginBottom: Theme.spacing.lg,
  },
  cancelReasonInput: {
    borderWidth: 1.5, borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    fontSize: Theme.font.sm, color: Theme.colors.text,
    minHeight: 100, marginBottom: Theme.spacing.lg,
  },
  cancelSheetActions: { flexDirection: 'row', gap: Theme.spacing.md },
  cancelSheetDismiss: {
    flex: 1, height: 48, justifyContent: 'center', alignItems: 'center',
    borderRadius: Theme.radius.md, borderWidth: 1.5, borderColor: Theme.colors.border,
  },
  cancelSheetDismissText: { color: Theme.colors.textSecondary, fontWeight: '600' },
  cancelSheetConfirm: {
    flex: 1, height: 48, justifyContent: 'center', alignItems: 'center',
    borderRadius: Theme.radius.md, backgroundColor: Theme.colors.danger,
  },
  cancelSheetConfirmText: { color: Theme.colors.white, fontWeight: '700' },

  // Modal
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.lg, paddingVertical: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight,
  },
  backBtn: { padding: 4 },
  modalHeaderTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },
  modalScroll: { padding: Theme.spacing.lg, paddingBottom: 48 },

  modalStatusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md,
    borderRadius: Theme.radius.xl, padding: Theme.spacing.lg, marginBottom: Theme.spacing.md,
  },
  modalStatusIcon: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  modalStatusLabel: { fontSize: Theme.font.lg, fontWeight: '800' },
  modalStatusDate: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, marginTop: 2 },
  modalStatusNum: { fontSize: Theme.font.sm, color: Theme.colors.textMuted, marginTop: 1 },

  canceledBanner: {
    flexDirection: 'row', gap: Theme.spacing.md, alignItems: 'flex-start',
    backgroundColor: Theme.colors.dangerSurface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.md, marginBottom: Theme.spacing.md,
    borderWidth: 1, borderColor: Theme.colors.danger + '30',
  },
  canceledBannerTitle: { fontSize: Theme.font.sm, fontWeight: '700', color: Theme.colors.danger, marginBottom: 2 },
  canceledBannerText: { fontSize: Theme.font.sm, color: Theme.colors.text, marginBottom: 4 },
  canceledBannerRefund: { fontSize: 11, color: Theme.colors.textSecondary },

  detailCard: {
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg, marginBottom: Theme.spacing.md,
    borderWidth: 1, borderColor: Theme.colors.borderLight, ...Theme.shadow.sm,
  },
  detailCardTitle: {
    fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.text,
    marginBottom: Theme.spacing.md,
  },
  detailItemRow: {
    flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
  },
  detailItemBorder: { borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight },
  detailItemImg: {
    width: 52, height: 52, borderRadius: Theme.radius.sm,
    backgroundColor: Theme.colors.surfaceSecondary,
  },
  detailItemName: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.text, marginBottom: 2 },
  detailItemQty: { fontSize: 11, color: Theme.colors.textMuted },
  detailItemPrice: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.text },
  detailTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  detailTotalLabel: { fontSize: Theme.font.md, fontWeight: '600', color: Theme.colors.text },
  detailTotalValue: { fontSize: Theme.font.xl, fontWeight: '800', color: Theme.colors.text },
  detailPayRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailPayText: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary },
  addrName: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.text, marginBottom: 4 },
  addrPhone: { fontSize: Theme.font.sm, color: Theme.colors.primary, marginBottom: 4 },
  addrLine: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, lineHeight: 20 },

  updateStatusBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.md,
    height: 52, marginBottom: Theme.spacing.sm, ...Theme.shadow.sm,
  },
  updateStatusText: { color: Theme.colors.white, fontSize: Theme.font.md, fontWeight: '700' },
  cancelOrderBtn: {
    borderRadius: Theme.radius.md, height: 48,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Theme.colors.danger,
    backgroundColor: Theme.colors.dangerSurface,
  },
  cancelOrderText: { color: Theme.colors.danger, fontSize: Theme.font.md, fontWeight: '600' },
});

// Orders and products are selling features: locked, as on the server, while
// the subscription is not active or the shop is not approved.
export default withSellingGate(VendorOrdersScreen, 'Orders');
