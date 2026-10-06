import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Alert, RefreshControl, ActivityIndicator, TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { Theme } from '../../constants/theme';
import { withSellingGate } from '../../components/vendor/SellingGate';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';

interface VendorProduct {
  _id: string;
  name: string;
  price: number;
  discountPrice?: number;
  images: string[];
  stock: number;
  approvalStatus: 'approved' | 'pending' | 'rejected';
  category?: { name: string };
  createdAt: string;
}

interface ProductStats {
  totalOrders: number;
  totalQuantity: number;
  totalRevenue: number;
}

type FilterKey = 'all' | 'approved' | 'pending' | 'rejected';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'pending', label: 'Pending' },
  { key: 'rejected', label: 'Rejected' },
];

const STATUS_META: Record<string, { color: string; bg: string }> = {
  approved: { color: Theme.colors.success, bg: Theme.colors.successSurface },
  pending:  { color: '#D97706',            bg: '#FFF9EC' },
  rejected: { color: Theme.colors.danger,  bg: Theme.colors.dangerSurface },
};

function VendorProductsScreen() {
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  // Stats modal state
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<VendorProduct | null>(null);
  const [productStats, setProductStats] = useState<ProductStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [])
  );

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get('/api/vendor/products');
      const data = res.data?.products ?? res.data ?? [];
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('fetchVendorProducts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleDelete = (product: VendorProduct) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${product.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/vendor/products/${product._id}`);
              setProducts((prev) => prev.filter((p) => p._id !== product._id));
            } catch {
              Alert.alert('Error', 'Failed to delete product');
            }
          },
        },
      ]
    );
  };

  const fetchProductStats = async (product: VendorProduct) => {
    setSelectedProduct(product);
    setStatsModalVisible(true);
    setLoadingStats(true);
    try {
      const res = await api.get('/api/vendor/products/stats');
      const allStats: any[] = res.data;
      const statsForProduct = allStats.find((s: any) => s._id === product._id);
      setProductStats(statsForProduct || { totalOrders: 0, totalQuantity: 0, totalRevenue: 0 });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      Alert.alert('Error', 'Could not load product stats');
      setProductStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  const filtered = products.filter((p) => {
    const matchFilter = filter === 'all' || p.approvalStatus === filter;
    const matchSearch = !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase());
    return matchFilter && matchSearch;
  });

  const renderProduct = ({ item }: { item: VendorProduct }) => {
    const name = item.name ?? 'Unnamed Product';
    const status = item.approvalStatus ?? 'pending';
    const meta = STATUS_META[status] ?? STATUS_META.pending;
    const images = item.images?.length ? item.images : ['https://via.placeholder.com/80'];
    const categoryName = item.category?.name ?? '';
    const stock = item.stock ?? 0;
    const price = item.price ?? 0;
    const discountPrice = item.discountPrice ?? null;

    const isLowStock = stock > 0 && stock <= 5;
    const isOutOfStock = stock === 0;

    const formatStatus = (statusStr: string) =>
      statusStr.charAt(0).toUpperCase() + statusStr.slice(1);

    return (
      <View style={styles.productCard}>
        <Image source={{ uri: images[0] }} style={styles.productImg} />
        <View style={styles.productInfo}>
          <View style={styles.productTopRow}>
            <Text style={styles.productName} numberOfLines={2}>{name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
              <Text style={[styles.statusText, { color: meta.color }]}>
                {formatStatus(status)}
              </Text>
            </View>
          </View>

          {categoryName.length > 0 && (
            <Text style={styles.categoryText}>{categoryName}</Text>
          )}

          <View style={styles.productMidRow}>
            <View>
              <Text style={styles.productPrice}>₹{discountPrice ?? price}</Text>
              {discountPrice && (
                <Text style={styles.productOriginal}>₹{price}</Text>
              )}
            </View>
            <View style={[
              styles.stockBadge,
              isOutOfStock && styles.stockBadgeOut,
              isLowStock && styles.stockBadgeLow,
            ]}>
              <Text style={[
                styles.stockText,
                isOutOfStock && styles.stockTextOut,
                isLowStock && styles.stockTextLow,
              ]}>
                {isOutOfStock ? 'Out of Stock' : `${stock} in stock`}
              </Text>
            </View>
          </View>

          <View style={styles.productActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => fetchProductStats(item)}
            >
              <Ionicons name="bar-chart-outline" size={16} color={Theme.colors.primary} />
              <Text style={styles.actionBtnText}>Stats</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push(`/(vendor)/products/edit/${item._id}`)}
            >
              <Ionicons name="create-outline" size={16} color={Theme.colors.primary} />
              <Text style={styles.actionBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={() => handleDelete(item)}
            >
              <Ionicons name="trash-outline" size={16} color={Theme.colors.danger} />
              <Text style={[styles.actionBtnText, { color: Theme.colors.danger }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Products</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/(vendor)/products/add')}
        >
          <Ionicons name="add" size={20} color={Theme.colors.white} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={17} color={Theme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search your products..."
          placeholderTextColor={Theme.colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={17} color={Theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Pills */}
      <View style={styles.filtersRow}>
        {FILTERS.map((f) => {
          const count = f.key === 'all' 
            ? products.length 
            : products.filter((p) => p.approvalStatus === f.key).length;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterPill, filter === f.key && styles.filterPillActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                {f.label}
              </Text>
              {count > 0 && (
                <View style={[styles.filterBadge, filter === f.key && styles.filterBadgeActive]}>
                  <Text style={[styles.filterBadgeText, filter === f.key && styles.filterBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Count */}
      {!loading && (
        <View style={styles.countRow}>
          <Text style={styles.countText}>
            {filtered.length} product{filtered.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          renderItem={renderProduct}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProducts(); }} tintColor={Theme.colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="cube-outline" size={64} color={Theme.colors.border} />
              <Text style={styles.emptyTitle}>
                {search ? 'No products match your search' : 'No products yet'}
              </Text>
              <Text style={styles.emptySub}>
                {search ? 'Try different keywords' : 'Add your first product to start selling'}
              </Text>
              {!search && (
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => router.push('/(vendor)/products/add')}
                >
                  <Ionicons name="add" size={18} color={Theme.colors.white} />
                  <Text style={styles.emptyBtnText}>Add Product</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* Stats Modal */}
      <Modal
        visible={statsModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setStatsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedProduct?.name || 'Product Stats'}
              </Text>
              <TouchableOpacity onPress={() => setStatsModalVisible(false)}>
                <Ionicons name="close" size={24} color={Theme.colors.text} />
              </TouchableOpacity>
            </View>
            {loadingStats ? (
              <ActivityIndicator size="large" color={Theme.colors.primary} style={{ marginVertical: 40 }} />
            ) : productStats && (productStats.totalOrders > 0 || productStats.totalQuantity > 0) ? (
              <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{productStats.totalOrders}</Text>
                  <Text style={styles.statLabel}>Total Orders</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{productStats.totalQuantity}</Text>
                  <Text style={styles.statLabel}>Units Sold</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>₹{productStats.totalRevenue.toLocaleString()}</Text>
                  <Text style={styles.statLabel}>Revenue (Your Earnings)</Text>
                </View>
                <Text style={styles.statsNote}>
                  Based on completed/delivered orders only.
                </Text>
              </View>
            ) : (
              <View style={styles.noStatsContainer}>
                <Ionicons name="bar-chart-outline" size={48} color={Theme.colors.border} />
                <Text style={styles.noStatsText}>No sales data for this product yet.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg, paddingVertical: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight,
  },
  headerTitle: { fontSize: Theme.font.xl, fontWeight: '800', color: Theme.colors.text },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md, paddingVertical: 8,
  },
  addBtnText: { color: Theme.colors.white, fontWeight: '700', fontSize: Theme.font.sm },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm,
    backgroundColor: Theme.colors.surface,
    marginHorizontal: Theme.spacing.lg, marginVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md, height: 44,
    borderRadius: Theme.radius.md, borderWidth: 1, borderColor: Theme.colors.border,
  },
  searchInput: { flex: 1, fontSize: Theme.font.sm, color: Theme.colors.text },

  filtersRow: { flexDirection: 'row', gap: Theme.spacing.sm, paddingHorizontal: Theme.spacing.lg, marginBottom: Theme.spacing.sm },
  filterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Theme.spacing.md, paddingVertical: 6,
    borderRadius: Theme.radius.full, borderWidth: 1.5, borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
  },
  filterPillActive: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  filterText: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: Theme.colors.white, fontWeight: '700' },
  filterBadge: {
    backgroundColor: Theme.colors.surfaceSecondary,
    borderRadius: Theme.radius.full, minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterBadgeText: { fontSize: 10, color: Theme.colors.textSecondary, fontWeight: '700' },
  filterBadgeTextActive: { color: Theme.colors.white },

  countRow: { paddingHorizontal: Theme.spacing.lg, paddingBottom: Theme.spacing.sm },
  countText: { fontSize: Theme.font.sm, color: Theme.colors.textMuted },

  loaderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: Theme.spacing.lg, paddingBottom: 32 },

  productCard: {
    flexDirection: 'row', backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg, padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md, gap: Theme.spacing.md,
    borderWidth: 1, borderColor: Theme.colors.borderLight, ...Theme.shadow.sm,
  },
  productImg: {
    width: 88, height: 88, borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.surfaceSecondary,
  },
  productInfo: { flex: 1 },
  productTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  productName: { flex: 1, fontSize: Theme.font.sm, fontWeight: '700', color: Theme.colors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Theme.radius.full },
  statusText: { fontSize: 10, fontWeight: '700' },
  categoryText: { fontSize: 11, color: Theme.colors.textMuted, marginBottom: 6 },
  productMidRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.sm },
  productPrice: { fontSize: Theme.font.md, fontWeight: '800', color: Theme.colors.primary },
  productOriginal: { fontSize: 11, color: Theme.colors.textMuted, textDecorationLine: 'line-through' },
  stockBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Theme.radius.full, backgroundColor: Theme.colors.successSurface,
  },
  stockBadgeOut: { backgroundColor: Theme.colors.dangerSurface },
  stockBadgeLow: { backgroundColor: '#FFF9EC' },
  stockText: { fontSize: 10, fontWeight: '600', color: Theme.colors.success },
  stockTextOut: { color: Theme.colors.danger },
  stockTextLow: { color: '#D97706' },
  productActions: { flexDirection: 'row', gap: Theme.spacing.sm, marginTop: 4 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Theme.spacing.md, paddingVertical: 6,
    borderRadius: Theme.radius.sm, borderWidth: 1, borderColor: Theme.colors.primaryLight,
    backgroundColor: Theme.colors.primarySurface,
  },
  actionBtnDanger: { borderColor: '#FECACA', backgroundColor: Theme.colors.dangerSurface },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: Theme.colors.primary },

  emptyBox: { flex: 1, alignItems: 'center', paddingTop: 80, gap: Theme.spacing.sm },
  emptyTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text, marginTop: 8 },
  emptySub: { fontSize: Theme.font.sm, color: Theme.colors.textMuted, textAlign: 'center' },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: Theme.spacing.md, backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.md, paddingHorizontal: Theme.spacing.xl, paddingVertical: Theme.spacing.md,
  },
  emptyBtnText: { color: Theme.colors.white, fontWeight: '700', fontSize: Theme.font.sm },

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
    maxWidth: 340,
    padding: Theme.spacing.lg,
    ...Theme.shadow.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.borderLight,
  },
  modalTitle: {
    fontSize: Theme.font.md,
    fontWeight: '700',
    color: Theme.colors.text,
    flex: 1,
    marginRight: Theme.spacing.md,
  },
  statsContainer: {
    marginTop: Theme.spacing.sm,
  },
  statCard: {
    backgroundColor: Theme.colors.primarySurface,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: Theme.colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: Theme.font.sm,
    color: Theme.colors.textSecondary,
  },
  statsNote: {
    fontSize: Theme.font.xs,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    marginTop: Theme.spacing.sm,
  },
  noStatsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: Theme.spacing.md,
  },
  noStatsText: {
    fontSize: Theme.font.sm,
    color: Theme.colors.textMuted,
    textAlign: 'center',
  },
});

// Orders and products are selling features: locked, as on the server, while
// the subscription is not active or the shop is not approved.
export default withSellingGate(VendorProductsScreen, 'Products');
