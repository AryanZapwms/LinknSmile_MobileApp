// app/(customer)/orders.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { Theme } from '../../constants/theme';
import { useLocalSearchParams } from 'expo-router';

type OrderStatus = 'all' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

interface OrderItem {
  productId: string;
  name: string;
  image?: string;
  price: number;
  quantity: number;
}

interface Order {
  _id: string;
  orderNumber?: string;
  items: OrderItem[];
  total: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
  shippingAddress?: {
    name?: string;
    city?: string;
    state?: string;
  };
}

const STATUS_TABS: { key: OrderStatus; label: string }[] = [
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

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { filter } = useLocalSearchParams<{ filter?: OrderStatus }>();
  const [activeTab, setActiveTab] = useState<OrderStatus>('all');

 const fetchOrders = useCallback(async () => {
  try {
    const res = await api.get('/api/orders');
    // Backend returns an array of orders directly (or wrapped in { orders })
    const rawOrders = res.data?.orders ?? res.data ?? [];
    const mappedOrders = (Array.isArray(rawOrders) ? rawOrders : []).map((order: any) => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      // Map backend field names
      status: order.orderStatus,
      total: order.totalAmount,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
      shippingAddress: order.shippingAddress,
      items: (order.items || []).map((item: any) => ({
        productId: item.product?._id || item.productId,
        name: item.product?.name || 'Product',
        image: item.product?.image,
        price: item.price,
        quantity: item.quantity,
      })),
    }));
    setOrders(mappedOrders);
  } catch (err) {
    console.error('fetchOrders error:', err);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
}, []);

  useEffect(() => { fetchOrders(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchOrders(); };

  const filtered = activeTab === 'all'
    ? orders
    : orders.filter((o) => o.status?.toLowerCase() === activeTab);

  const renderOrder = ({ item }: { item: Order }) => {
    const meta = STATUS_META[item.status?.toLowerCase()] ?? STATUS_META.pending;
    const firstImage = item.items?.[0]?.image;
    const date = new Date(item.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => router.push(`/(customer)/profile/orders/${item._id}` as any)}
        activeOpacity={0.88}
      >
        {/* Top row */}
        <View style={styles.orderCardTop}>
          <View style={styles.orderMeta}>
            <Text style={styles.orderNum}>
              #{item.orderNumber ?? item._id.slice(-8).toUpperCase()}
            </Text>
            <Text style={styles.orderDate}>{date}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon as any} size={13} color={meta.color} />
            <Text style={[styles.statusText, { color: meta.color }]}>
              {item.status?.charAt(0).toUpperCase() + item.status?.slice(1)}
            </Text>
          </View>
        </View>

        {/* Items preview */}
        <View style={styles.itemsPreview}>
          {firstImage && (
            <Image
              source={{ uri: firstImage }}
              style={styles.itemThumb}
            />
          )}
          <View style={styles.itemsSummary}>
            <Text style={styles.itemsText} numberOfLines={1}>
              {item.items?.[0]?.name ?? 'Item'}
              {item.items?.length > 1 ? ` + ${item.items.length - 1} more` : ''}
            </Text>
            <Text style={styles.itemCount}>
              {item.items?.reduce((s, i) => s + i.quantity, 0)} item(s)
            </Text>
          </View>
        </View>

        {/* Bottom row */}
        <View style={styles.orderCardBottom}>
          <View style={styles.paymentInfo}>
            <Ionicons
              name={item.paymentMethod === 'cod' ? 'cash-outline' : 'card-outline'}
              size={14}
              color={Theme.colors.textMuted}
            />
            <Text style={styles.paymentText}>
              {item.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}
            </Text>
          </View>
          <Text style={styles.orderTotal}>₹{(item.total ?? 0).toFixed(0)}</Text>
        </View>

        {/* View details */}
        <View style={styles.viewDetails}>
          <Text style={styles.viewDetailsText}>View Details</Text>
          <Ionicons name="chevron-forward" size={14} color={Theme.colors.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
        {orders.length > 0 && (
          <View style={styles.orderCountBadge}>
            <Text style={styles.orderCountText}>{orders.length}</Text>
          </View>
        )}
      </View>

      {/* Status Tabs */}
      <FlatList
         horizontal
  showsHorizontalScrollIndicator={false}
  data={STATUS_TABS}
  keyExtractor={(item) => item.key}
  contentContainerStyle={styles.tabsRow}
  style={styles.tabsContainer} 
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
  <View style={[styles.tabBadge, activeTab === tab.key && styles.tabBadgeActive, count === 0 && { opacity: 0 }]}>
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="receipt-outline" size={72} color={Theme.colors.border} />
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptySub}>
                {activeTab === 'all'
                  ? "You haven't placed any orders yet."
                  : `No ${activeTab} orders found.`}
              </Text>
              {activeTab === 'all' && (
                <TouchableOpacity
                  style={styles.shopBtn}
                  onPress={() => router.push('/(customer)/home')}
                >
                  <Text style={styles.shopBtnText}>Start Shopping</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
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
  orderCountBadge: {
    backgroundColor: Theme.colors.primarySurface, borderRadius: Theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: Theme.colors.primaryLight,
  },
  orderCountText: { fontSize: Theme.font.sm, color: Theme.colors.primary, fontWeight: '700' },


  tabsContainer: {
  flexGrow: 0,        // ← prevents FlatList from expanding vertically
  height: 64,         // ← fixed height (tab 40 + vertical padding)
},

tabsRow: {
  paddingHorizontal: Theme.spacing.lg,
  paddingVertical: Theme.spacing.sm,
  gap: Theme.spacing.sm,
  alignItems: 'center',  // ← vertically centers tabs within the row
},

tab: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  paddingHorizontal: Theme.spacing.md,

  borderRadius: Theme.radius.full,
  borderWidth: 2,
  borderColor: Theme.colors.border,
  backgroundColor: Theme.colors.surface,
  minWidth: 80,
  height: 40,          // ← fix the height so it never shifts vertically
  alignSelf: 'center', // ← prevent vertical stretching in the FlatList row
},

tabActive: {
  borderColor: Theme.colors.primary,   // only colour changes
  backgroundColor: Theme.colors.primary,
},

tabText: {
  fontSize: Theme.font.sm,
  fontWeight: '600',
  color: Theme.colors.text,
  lineHeight: 18,   // ← explicit lineHeight prevents text from shifting
  includeFontPadding: false, // ← Android-specific fix for text causing height changes
},

tabTextActive: {
  color: '#FFFFFF',
},

tabBadge: {
  backgroundColor: Theme.colors.surfaceSecondary,
  borderRadius: Theme.radius.full,
  minWidth: 18,
  height: 18,
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: 4,
},

tabBadgeActive: {
  backgroundColor: 'rgba(255,255,255,0.25)',
},

tabBadgeText: {
  fontSize: 10,
  color: Theme.colors.text,
  fontWeight: '700',
},

tabBadgeTextActive: {
  color: '#FFFFFF',
},

  loaderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: Theme.spacing.lg, paddingBottom: 32 },

  orderCard: {
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg, marginBottom: Theme.spacing.md,
    borderWidth: 1, borderColor: Theme.colors.borderLight,
    ...Theme.shadow.sm,
  },
  orderCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Theme.spacing.md },
  orderMeta: { gap: 2 },
  orderNum: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.text },
  orderDate: { fontSize: Theme.font.xs, color: Theme.colors.textMuted },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Theme.radius.full,
  },
  statusText: { fontSize: Theme.font.xs, fontWeight: '700' },

  itemsPreview: {
    flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: Theme.colors.borderLight,
    marginBottom: Theme.spacing.md,
  },
  itemThumb: {
    width: 48, height: 48, borderRadius: Theme.radius.sm,
    backgroundColor: Theme.colors.surfaceSecondary,
  },
  itemsSummary: { flex: 1 },
  itemsText: { fontSize: Theme.font.sm, fontWeight: '500', color: Theme.colors.text },
  itemCount: { fontSize: Theme.font.xs, color: Theme.colors.textMuted, marginTop: 2 },

  orderCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.sm },
  paymentInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  paymentText: { fontSize: Theme.font.xs, color: Theme.colors.textMuted },
  orderTotal: { fontSize: Theme.font.lg, fontWeight: '800', color: Theme.colors.text },

  viewDetails: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2,
  },
  viewDetailsText: { fontSize: Theme.font.sm, color: Theme.colors.primary, fontWeight: '600' },

  emptyBox: { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: Theme.font.xl, fontWeight: '700', color: Theme.colors.text, marginTop: 16, marginBottom: 6 },
  emptySub: { fontSize: Theme.font.sm, color: Theme.colors.textMuted, textAlign: 'center', lineHeight: 20 },
  shopBtn: {
    marginTop: Theme.spacing.xl, backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.md, paddingHorizontal: Theme.spacing.xxl, paddingVertical: Theme.spacing.md,
  },
  shopBtnText: { color: Theme.colors.white, fontWeight: '700', fontSize: Theme.font.md },
});