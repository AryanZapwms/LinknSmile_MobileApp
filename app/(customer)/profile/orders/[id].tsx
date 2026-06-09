import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Image, Alert, Linking,
  Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../../services/api';
import { Theme } from '../../../../constants/theme';

interface OrderDetail {
  _id: string;
  orderNumber?: string;
  status: string;
  paymentMethod: string;
  createdAt: string;
  cancellationReason?: string;  // added
  items: {
    productId: string;
    name: string;
    image?: string;
    price: number;
    quantity: number;
    selectedSize?: { size: string; quantity: number; unit: string };
  }[];
  shippingAddress: {
    name?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  promoCode?: string;
}

const STATUS_META: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  pending:    { color: '#D97706', bg: '#FFF9EC', icon: 'time-outline',             label: 'Pending' },
  processing: { color: Theme.colors.primary, bg: Theme.colors.primarySurface, icon: 'construct-outline', label: 'Processing' },
  shipped:    { color: '#2563EB', bg: '#EFF6FF', icon: 'car-outline',              label: 'Shipped' },
  delivered:  { color: Theme.colors.success, bg: Theme.colors.successSurface, icon: 'checkmark-circle-outline', label: 'Delivered' },
  cancelled:  { color: Theme.colors.danger,  bg: Theme.colors.dangerSurface,  icon: 'close-circle-outline',    label: 'Cancelled' },
};

const TIMELINE = ['pending', 'processing', 'shipped', 'delivered'];

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Review modal states
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string } | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewedProducts, setReviewedProducts] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/api/orders/${id}`);
        const rawOrder = res.data?.order ?? res.data;
        
        const items = (rawOrder.items || []).map((item: any) => ({
          productId: item.product?._id || item.productId,
          name: item.product?.name || 'Product',
          image: item.product?.image,
          price: item.price,
          quantity: item.quantity,
          selectedSize: item.selectedSize,
        }));
        
        const computedSubtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        const mappedOrder: OrderDetail = {
          _id: rawOrder._id,
          orderNumber: rawOrder.orderNumber,
          status: rawOrder.orderStatus,
          paymentMethod: rawOrder.paymentMethod,
          createdAt: rawOrder.createdAt,
          cancellationReason: rawOrder.cancellationReason, // added
          items: items,
          shippingAddress: rawOrder.shippingAddress || {},
          subtotal: rawOrder.subtotal ?? computedSubtotal,
          shippingCost: rawOrder.shippingCost ?? 0,
          discount: rawOrder.discount ?? 0,
          total: rawOrder.totalAmount ?? rawOrder.total ?? 0,
          promoCode: rawOrder.promoCode,
        };
        
        setOrder(mappedOrder);
      } catch {
        Alert.alert('Error', 'Could not load order details');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const openReviewModal = (productId: string, productName: string) => {
    setSelectedProduct({ id: productId, name: productName });
    setRating(0);
    setReviewText('');
    setShowReviewModal(true);
  };

  const submitReview = async () => {
    if (!selectedProduct) return;
    if (rating === 0) {
      Alert.alert('Rating required', 'Please select a star rating.');
      return;
    }
    setSubmittingReview(true);
    try {
      await api.post(`/api/products/${selectedProduct.id}/reviews`, {
        rating,
        comment: reviewText.trim() || undefined,
      });
      Alert.alert('Thank you!', 'Your review has been submitted.');
      setShowReviewModal(false);
      setReviewedProducts(prev => new Set(prev).add(selectedProduct.id));
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to submit review. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.loaderCenter}>
          <Ionicons name="alert-circle-outline" size={52} color={Theme.colors.border} />
          <Text style={styles.errorText}>Order not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const meta = STATUS_META[order.status?.toLowerCase()] ?? STATUS_META.pending;
  const isCancelled = order.status?.toLowerCase() === 'cancelled';
  const isDelivered = order.status?.toLowerCase() === 'delivered';
  const currentStep = TIMELINE.indexOf(order.status?.toLowerCase());
  const date = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: meta.bg }]}>
          <View style={[styles.statusIconCircle, { backgroundColor: meta.color }]}>
            <Ionicons name={meta.icon as any} size={24} color={Theme.colors.white} />
          </View>
          <View style={styles.statusInfo}>
            <Text style={[styles.statusLabel, { color: meta.color }]}>{meta.label}</Text>
            <Text style={styles.statusDate}>{date}</Text>
            <Text style={styles.statusOrderNum}>
              #{order.orderNumber ?? order._id.slice(-8).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Cancellation Reason Alert */}
        {isCancelled && order.cancellationReason && (
          <View style={styles.cancelAlert}>
            <Ionicons name="information-circle-outline" size={20} color={Theme.colors.danger} />
            <Text style={styles.cancelAlertText}>
              Cancelled: {order.cancellationReason}
            </Text>
          </View>
        )}

        {/* Timeline — only for non-cancelled orders */}
        {!isCancelled && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Order Progress</Text>
            <View style={styles.timeline}>
              {TIMELINE.map((step, i) => {
                const done = currentStep >= i;
                const active = currentStep === i;
                return (
                  <View key={step} style={styles.timelineItem}>
                    <View style={styles.timelineLeft}>
                      <View style={[
                        styles.timelineDot,
                        done && styles.timelineDotDone,
                        active && styles.timelineDotActive,
                      ]}>
                        {done && <Ionicons name="checkmark" size={10} color={Theme.colors.white} />}
                      </View>
                      {i < TIMELINE.length - 1 && (
                        <View style={[styles.timelineLine, done && styles.timelineLineDone]} />
                      )}
                    </View>
                    <Text style={[styles.timelineLabel, done && styles.timelineLabelDone]}>
                      {step.charAt(0).toUpperCase() + step.slice(1)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Items Ordered</Text>
          {order.items.map((item, i) => {
            const alreadyReviewed = reviewedProducts.has(item.productId);
            return (
              <View key={i} style={[styles.itemRow, i < order.items.length - 1 && styles.itemRowBorder]}>
                <Image
                  source={{ uri: item.image ?? 'https://via.placeholder.com/60' }}
                  style={styles.itemImg}
                />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                  {item.selectedSize && (
                    <Text style={styles.itemSize}>
                      {item.selectedSize.size} · {item.selectedSize.quantity}{item.selectedSize.unit}
                    </Text>
                  )}
                  <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemPrice}>
                    ₹{(item.price * item.quantity).toFixed(0)}
                  </Text>
                  {isDelivered && (
                    <TouchableOpacity
                      style={[styles.reviewBtn, alreadyReviewed && styles.reviewBtnDisabled]}
                      onPress={() => !alreadyReviewed && openReviewModal(item.productId, item.name)}
                      disabled={alreadyReviewed}
                    >
                      <Text style={styles.reviewBtnText}>
                        {alreadyReviewed ? 'Reviewed' : 'Write Review'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Delivery Address */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Delivery Address</Text>
            <Ionicons name="location-outline" size={18} color={Theme.colors.primary} />
          </View>
          <Text style={styles.addrName}>{order.shippingAddress.name}</Text>
          {order.shippingAddress.phone && (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.shippingAddress.phone}`)}>
              <Text style={styles.addrPhone}>{order.shippingAddress.phone}</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.addrLine}>
            {[
              order.shippingAddress.addressLine1,
              order.shippingAddress.addressLine2,
              order.shippingAddress.city,
              order.shippingAddress.state,
              order.shippingAddress.pincode,
            ].filter(Boolean).join(', ')}
          </Text>
        </View>

        {/* Payment Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Summary</Text>
          <View style={styles.payMethodRow}>
            <Ionicons
              name={order.paymentMethod === 'cod' ? 'cash-outline' : 'card-outline'}
              size={16}
              color={Theme.colors.textSecondary}
            />
            <Text style={styles.payMethodText}>
              {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}
            </Text>
          </View>
          <View style={styles.divider} />
          <SummaryRow label="Subtotal" value={`₹${order.subtotal?.toFixed(0) ?? '—'}`} />
          <SummaryRow label="Shipping" value={order.shippingCost === 0 ? 'FREE' : `₹${order.shippingCost}`} valueColor={order.shippingCost === 0 ? Theme.colors.success : undefined} />
          {(order.discount ?? 0) > 0 && (
            <SummaryRow label={`Promo (${order.promoCode ?? ''})`} value={`−₹${order.discount}`} valueColor={Theme.colors.success} />
          )}
          <View style={styles.divider} />
          <SummaryRow label="Total Paid" value={`₹${order.total?.toFixed(0)}`} bold />
        </View>

        {/* Help */}
        <View style={styles.helpBox}>
          <Text style={styles.helpTitle}>Need help with this order?</Text>
          <TouchableOpacity
            style={styles.helpBtn}
            onPress={() => Linking.openURL('tel:+919820623835')}
          >
            <Ionicons name="call-outline" size={16} color={Theme.colors.white} />
            <Text style={styles.helpBtnText}>Call Support</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Review Modal */}
      <Modal
        visible={showReviewModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Review Product</Text>
              <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                <Ionicons name="close" size={24} color={Theme.colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalProductName}>{selectedProduct?.name}</Text>
            <View style={styles.starContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={32}
                    color={star <= rating ? '#FFD700' : Theme.colors.border}
                    style={styles.starIcon}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.reviewInput}
              placeholder="Write your review (optional)"
              placeholderTextColor={Theme.colors.textMuted}
              multiline
              value={reviewText}
              onChangeText={setReviewText}
            />
            <TouchableOpacity
              style={[styles.submitBtn, submittingReview && styles.submitBtnDisabled]}
              onPress={submitReview}
              disabled={submittingReview}
            >
              {submittingReview ? (
                <ActivityIndicator size="small" color={Theme.colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>Submit Review</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  loaderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { fontSize: Theme.font.md, color: Theme.colors.textSecondary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.lg, paddingVertical: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },

  scroll: { padding: Theme.spacing.lg },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.lg,
    borderRadius: Theme.radius.xl, padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
  },
  statusIconCircle: {
    width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center',
  },
  statusInfo: { flex: 1 },
  statusLabel: { fontSize: Theme.font.lg, fontWeight: '800' },
  statusDate: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, marginTop: 2 },
  statusOrderNum: { fontSize: Theme.font.sm, color: Theme.colors.textMuted, marginTop: 1 },

  cancelAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Theme.colors.dangerSurface,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.danger + '40',
  },
  cancelAlertText: {
    flex: 1,
    fontSize: Theme.font.sm,
    color: Theme.colors.danger,
  },

  card: {
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg, marginBottom: Theme.spacing.md,
    borderWidth: 1, borderColor: Theme.colors.borderLight, ...Theme.shadow.sm,
  },
  cardTitle: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.text, marginBottom: Theme.spacing.md },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.md },

  timeline: { gap: 0 },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', gap: Theme.spacing.md },
  timelineLeft: { alignItems: 'center', width: 20 },
  timelineDot: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  timelineDotDone: { backgroundColor: Theme.colors.success, borderColor: Theme.colors.success },
  timelineDotActive: { borderColor: Theme.colors.primary, backgroundColor: Theme.colors.primarySurface },
  timelineLine: { width: 2, height: 28, backgroundColor: Theme.colors.border, marginTop: 2 },
  timelineLineDone: { backgroundColor: Theme.colors.success },
  timelineLabel: { fontSize: Theme.font.sm, color: Theme.colors.textMuted, paddingTop: 2, paddingBottom: Theme.spacing.md },
  timelineLabelDone: { color: Theme.colors.text, fontWeight: '600' },

  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Theme.spacing.md, paddingVertical: Theme.spacing.sm },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight },
  itemImg: { width: 56, height: 56, borderRadius: Theme.radius.sm, backgroundColor: Theme.colors.surfaceSecondary },
  itemInfo: { flex: 1 },
  itemName: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.text, marginBottom: 2 },
  itemSize: { fontSize: 11, color: Theme.colors.primary, marginBottom: 2 },
  itemQty: { fontSize: 11, color: Theme.colors.textMuted },
  itemPrice: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.text },
  itemRight: { alignItems: 'flex-end', gap: 8 },
  reviewBtn: {
    backgroundColor: Theme.colors.primarySurface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.radius.sm,
    borderWidth: 1,
    borderColor: Theme.colors.primaryLight,
  },
  reviewBtnDisabled: { opacity: 0.5, backgroundColor: Theme.colors.surfaceSecondary },
  reviewBtnText: { fontSize: 11, fontWeight: '600', color: Theme.colors.primary },

  addrName: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.text, marginBottom: 4 },
  addrPhone: { fontSize: Theme.font.sm, color: Theme.colors.primary, marginBottom: 4 },
  addrLine: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, lineHeight: 20 },

  payMethodRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Theme.spacing.md },
  payMethodText: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, fontWeight: '500' },
  divider: { height: 1, backgroundColor: Theme.colors.borderLight, marginVertical: Theme.spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary },
  summaryLabelBold: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.text },
  summaryValue: { fontSize: Theme.font.sm, fontWeight: '500', color: Theme.colors.text },
  summaryValueBold: { fontSize: Theme.font.lg, fontWeight: '800', color: Theme.colors.text },

  helpBox: {
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg, alignItems: 'center', gap: Theme.spacing.md,
    borderWidth: 1, borderColor: Theme.colors.borderLight,
  },
  helpTitle: { fontSize: Theme.font.md, fontWeight: '600', color: Theme.colors.text },
  helpBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.xxl, paddingVertical: Theme.spacing.md,
  },
  helpBtnText: { color: Theme.colors.white, fontWeight: '700', fontSize: Theme.font.sm },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.xl,
    width: '85%',
    padding: Theme.spacing.lg,
    ...Theme.shadow.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  modalTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },
  modalProductName: { fontSize: Theme.font.md, fontWeight: '600', color: Theme.colors.text, marginBottom: Theme.spacing.md, textAlign: 'center' },
  starContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: Theme.spacing.lg },
  starIcon: { marginHorizontal: 2 },
  reviewInput: {
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: Theme.font.sm,
    color: Theme.colors.text,
    marginBottom: Theme.spacing.lg,
  },
  submitBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.md,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: Theme.colors.white, fontWeight: '700', fontSize: Theme.font.md },
});