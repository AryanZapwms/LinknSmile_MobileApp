// app/(vendor)/dashboard.tsx
// FIXED: Recent orders now show correct amount (vendorEarnings)
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth.store';
import { api } from '../../services/api';
import { Theme } from '../../constants/theme';
import { useSellingBlock } from '../../components/vendor/SellingGate';
import { VendorStatusBanner } from '../../components/vendor/VendorStatusBanner';

interface VendorStats {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  totalProducts: number;
  walletBalance: number;
  recentOrders: RecentOrder[];
}

interface RecentOrder {
  _id: string;
  orderNumber?: string;
  orderStatus: string;
  createdAt: string;
  vendorEarnings: number;   // ✅ use this for amount
}

const STATUS_META: Record<string, { color: string; bg: string }> = {
  pending:    { color: '#D97706', bg: '#FFF9EC' },
  processing: { color: Theme.colors.primary, bg: Theme.colors.primarySurface },
  shipped:    { color: '#2563EB', bg: '#EFF6FF' },
  delivered:  { color: Theme.colors.success, bg: Theme.colors.successSurface },
  cancelled:  { color: Theme.colors.danger,  bg: Theme.colors.dangerSurface },
};

export default function VendorDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<VendorStats>({
    totalRevenue: 0, totalOrders: 0, pendingOrders: 0,
    totalProducts: 0, walletBalance: 0, recentOrders: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Orders are a selling feature: the server refuses them while the
  // subscription is inactive or the shop is unapproved. Stats and wallet stay open.
  const sellingLocked = useSellingBlock() !== null;

  const fetchStats = useCallback(async () => {
    try {
      const [statsRes, walletRes, ordersRes] = await Promise.allSettled([
        api.get('/api/vendor/stats'),
        api.get('/api/vendor/wallet'),
        sellingLocked ? { data: { orders: [] } } : api.get('/api/vendor/orders?limit=5'),
      ]);

      const statsData = statsRes.status === 'fulfilled' ? statsRes.value.data : {};
      const walletData = walletRes.status === 'fulfilled' ? walletRes.value.data : {};
      let recentOrdersData: RecentOrder[] = [];

      if (ordersRes.status === 'fulfilled') {
        const orders = ordersRes.value.data?.orders ?? [];
        recentOrdersData = orders.map((o: any) => ({
          _id: o._id,
          orderNumber: o.orderNumber,
          orderStatus: o.orderStatus ?? 'pending',
          createdAt: o.createdAt,
          vendorEarnings: Number(o.vendorEarnings) || 0,
        }));
      } else {
        console.error('Failed to fetch recent orders:', ordersRes.reason);
      }

      // Fallback to stats recentOrders if orders API failed (but those may lack earnings)
      if (recentOrdersData.length === 0 && statsData.recentOrders?.length) {
        recentOrdersData = statsData.recentOrders.map((o: any) => ({
          _id: o._id,
          orderNumber: o.orderNumber,
          orderStatus: o.orderStatus ?? o.status ?? 'pending',
          createdAt: o.createdAt,
          vendorEarnings: Number(o.vendorEarnings) || Number(o.vendorSubtotal) || 0,
        }));
      }

      const totalRevenue = statsData.stats?.totalEarnings ?? statsData.totalEarnings ?? 0;
      const totalOrders = statsData.stats?.totalOrders ?? statsData.totalOrders ?? 0;
      const totalProducts = statsData.stats?.totalProducts ?? statsData.totalProducts ?? 0;
      const pendingOrders = statsData.stats?.pendingOrders ??
        recentOrdersData.filter(o => o.orderStatus === 'pending').length;

      const newStats: VendorStats = {
        totalRevenue: Number(totalRevenue),
        totalOrders: Number(totalOrders),
        pendingOrders: Number(pendingOrders),
        totalProducts: Number(totalProducts),
        walletBalance: Number(walletData.withdrawableBalance ?? walletData.totalBalance ?? 0),
        recentOrders: recentOrdersData.slice(0, 5),
      };

      setStats(newStats);
    } catch (err) {
      console.error('[fetchStats] Unexpected error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sellingLocked]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const firstName = user?.name?.split(' ')[0] ?? 'Seller';

  const statCards = [
    {
      icon: 'cash-outline',
      label: 'Revenue',
      value: `₹${stats.totalRevenue.toFixed(0)}`,
      color: Theme.colors.success,
      onPress: () => router.push('/(vendor)/wallet'),
    },
    {
      icon: 'receipt-outline',
      label: 'Orders',
      value: String(stats.totalOrders),
      color: Theme.colors.primary,
      onPress: () => router.push('/(vendor)/orders'),
    },
    {
      icon: 'time-outline',
      label: 'Pending',
      value: String(stats.pendingOrders),
      color: '#D97706',
      onPress: () => router.push('/(vendor)/orders'),
    },
    {
      icon: 'cube-outline',
      label: 'Products',
      value: String(stats.totalProducts),
      color: '#2563EB',
      onPress: () => router.push('/(vendor)/products'),
    },
  ];

  const quickActions = [
    { icon: 'add-circle-outline', label: 'Add Product', onPress: () => router.push('/(vendor)/products/add') },
    { icon: 'receipt-outline',    label: 'Orders',      onPress: () => router.push('/(vendor)/orders') },
    { icon: 'wallet-outline',     label: 'Wallet',      onPress: () => router.push('/(vendor)/wallet') },
    { icon: 'star-outline',       label: 'Reviews',     onPress: () => router.push('/(vendor)/reviews' as any) },
  ];

  if (loading) {
    return (
      <View style={styles.loaderFull}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchStats(); }}
            tintColor={Theme.colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {firstName} 👋</Text>
            <Text style={styles.subGreeting}>Here's your store overview</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(vendor)/profile')} style={styles.avatarBtn}>
            {user?.image ? (
              <Image source={{ uri: user.image }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{(user?.name?.[0] ?? 'V').toUpperCase()}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <VendorStatusBanner />

        {/* Wallet Balance Hero */}
        <TouchableOpacity
          style={styles.walletHero}
          onPress={() => router.push('/(vendor)/wallet')}
          activeOpacity={0.9}
        >
          <View style={styles.walletLeft}>
            <Text style={styles.walletLabel}>Withdrawable Balance</Text>
            <Text style={styles.walletAmount}>₹{stats.walletBalance.toFixed(2)}</Text>
            <View style={styles.walletAction}>
              <Text style={styles.walletActionText}>View Wallet</Text>
              <Ionicons name="arrow-forward" size={14} color={Theme.colors.white} />
            </View>
          </View>
          <View style={styles.walletIllustration}>
            <Ionicons name="wallet" size={72} color="rgba(255,255,255,0.2)" />
          </View>
        </TouchableOpacity>

        {/* Stat Cards */}
        <View style={styles.statsGrid}>
          {statCards.map((card) => (
            <TouchableOpacity
              key={card.label}
              style={styles.statCard}
              onPress={card.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.statIconBox, { backgroundColor: card.color + '18' }]}>
                <Ionicons name={card.icon as any} size={22} color={card.color} />
              </View>
              <Text style={styles.statValue}>{card.value}</Text>
              <Text style={styles.statLabel}>{card.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={styles.quickCard}
                onPress={action.onPress}
                activeOpacity={0.8}
              >
                <View style={styles.quickIconBox}>
                  <Ionicons name={action.icon as any} size={24} color={Theme.colors.primary} />
                </View>
                <Text style={styles.quickLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Orders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <TouchableOpacity onPress={() => router.push('/(vendor)/orders')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {stats.recentOrders.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={40} color={Theme.colors.border} />
              <Text style={styles.emptyText}>No orders yet</Text>
            </View>
          ) : (
            stats.recentOrders.map((order, index) => {
              const statusKey = order.orderStatus?.toLowerCase() ?? 'pending';
              const meta = STATUS_META[statusKey] ?? STATUS_META.pending;
              const amount = order.vendorEarnings ?? 0;

              return (
                <TouchableOpacity
                  key={order._id || `order-${index}`}
                  style={styles.recentOrderRow}
                  onPress={() => router.push('/(vendor)/orders')}
                >
                  <View style={styles.recentOrderLeft}>
                    <Text style={styles.recentOrderNum}>
                      #{order.orderNumber ?? order._id?.slice(-6).toUpperCase()}
                    </Text>
                    <Text style={styles.recentOrderDate}>
                      {new Date(order.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short',
                      })}
                    </Text>
                  </View>
                  <View style={[styles.recentStatusBadge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.recentStatusText, { color: meta.color }]}>
                      {statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}
                    </Text>
                  </View>
                  <Text style={styles.recentOrderTotal}>₹{amount.toFixed(0)}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seller Tips</Text>
          {[
            { icon: 'camera-outline',   tip: 'Use high-quality images to increase conversions by up to 40%.' },
            { icon: 'pricetag-outline', tip: 'Competitive pricing helps you appear higher in search results.' },
            { icon: 'star-outline',     tip: 'Respond to reviews to build trust with customers.' },
          ].map((item, i) => (
            <View key={i} style={styles.tipRow}>
              <View style={styles.tipIconBox}>
                <Ionicons name={item.icon as any} size={18} color={Theme.colors.primary} />
              </View>
              <Text style={styles.tipText}>{item.tip}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  loaderFull: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg, paddingVertical: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight,
  },
  greeting: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },
  subGreeting: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, marginTop: 2 },
  avatarBtn: {},
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Theme.colors.primarySurface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Theme.colors.primaryLight,
  },
  avatarInitial: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.primary },

  walletHero: {
    margin: Theme.spacing.lg, borderRadius: Theme.radius.xl,
    backgroundColor: Theme.colors.primary,
    flexDirection: 'row', padding: Theme.spacing.xl,
    overflow: 'hidden', ...Theme.shadow.md,
  },
  walletLeft: { flex: 1 },
  walletLabel: { fontSize: Theme.font.sm, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  walletAmount: { fontSize: 32, fontWeight: '800', color: Theme.colors.white, marginBottom: Theme.spacing.md },
  walletAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  walletActionText: { fontSize: Theme.font.sm, color: Theme.colors.white, fontWeight: '600' },
  walletIllustration: { justifyContent: 'center' },

  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg, marginBottom: Theme.spacing.sm,
  },
  statCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg, alignItems: 'flex-start',
    borderWidth: 1, borderColor: Theme.colors.borderLight, ...Theme.shadow.sm,
  },
  statIconBox: {
    width: 40, height: 40, borderRadius: Theme.radius.md,
    justifyContent: 'center', alignItems: 'center', marginBottom: Theme.spacing.sm,
  },
  statValue: { fontSize: Theme.font.xl, fontWeight: '800', color: Theme.colors.text, marginBottom: 2 },
  statLabel: { fontSize: Theme.font.xs, color: Theme.colors.textMuted, fontWeight: '500' },

  section: { paddingHorizontal: Theme.spacing.lg, marginTop: Theme.spacing.lg },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  sectionTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text, marginBottom: Theme.spacing.md },
  seeAll: { fontSize: Theme.font.sm, color: Theme.colors.primary, fontWeight: '600' },

  quickGrid: { flexDirection: 'row', gap: Theme.spacing.sm },
  quickCard: {
    flex: 1, backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg, padding: Theme.spacing.md,
    alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: Theme.colors.borderLight, ...Theme.shadow.sm,
  },
  quickIconBox: {
    width: 48, height: 48, borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.primarySurface,
    justifyContent: 'center', alignItems: 'center',
  },
  quickLabel: { fontSize: 11, fontWeight: '600', color: Theme.colors.textSecondary, textAlign: 'center' },

  emptyCard: {
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.xxl, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: Theme.colors.borderLight,
  },
  emptyText: { fontSize: Theme.font.sm, color: Theme.colors.textMuted },

  recentOrderRow: {
    flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md,
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.md,
    padding: Theme.spacing.md, marginBottom: Theme.spacing.sm,
    borderWidth: 1, borderColor: Theme.colors.borderLight,
  },
  recentOrderLeft: { flex: 1 },
  recentOrderNum: { fontSize: Theme.font.sm, fontWeight: '700', color: Theme.colors.text },
  recentOrderDate: { fontSize: Theme.font.xs, color: Theme.colors.textMuted },
  recentStatusBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Theme.radius.full,
  },
  recentStatusText: { fontSize: 11, fontWeight: '700' },
  recentOrderTotal: { fontSize: Theme.font.md, fontWeight: '800', color: Theme.colors.text },

  tipRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Theme.spacing.md,
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.md,
    padding: Theme.spacing.md, marginBottom: Theme.spacing.sm,
    borderWidth: 1, borderColor: Theme.colors.borderLight,
  },
  tipIconBox: {
    width: 36, height: 36, borderRadius: Theme.radius.sm,
    backgroundColor: Theme.colors.primarySurface,
    justifyContent: 'center', alignItems: 'center',
  },
  tipText: { flex: 1, fontSize: Theme.font.sm, color: Theme.colors.textSecondary, lineHeight: 20, paddingTop: 8 },
});