// app/(customer)/product/list.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProductStore, Product } from '../../../store/product.store';
import { useCartStore } from '../../../store/cart.store';
import { Theme } from '../../../constants/theme';

const { width } = Dimensions.get('window');
const CARD_W = (width - Theme.spacing.lg * 2 - Theme.spacing.sm) / 2;

type SortKey = 'default' | 'price_asc' | 'price_desc' | 'rating';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Relevance' },
  { key: 'price_asc', label: 'Price: Low → High' },
  { key: 'price_desc', label: 'Price: High → Low' },
  { key: 'rating', label: 'Top Rated' },
];

export default function ProductListScreen() {
  const { products, categories, isLoading, fetchProducts, fetchCategories } = useProductStore();
  const totalItems = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  const params = useLocalSearchParams<{ category?: string; name?: string; search?: string }>();

  const [searchQuery, setSearchQuery] = useState(params.search ?? '');
  const [selectedCategory, setSelectedCategory] = useState(params.category ?? '');
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [showSort, setShowSort] = useState(false);
  const [loading, setLoading] = useState(true);

  const sortAnim = useRef(new Animated.Value(0)).current;

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const fetchParams: Record<string, any> = { limit: 100 };
    if (selectedCategory) fetchParams.category = selectedCategory;
    if (searchQuery.trim()) fetchParams.search = searchQuery.trim();
    await fetchProducts(fetchParams);
    if (categories.length === 0) await fetchCategories();
    setLoading(false);
  }, [selectedCategory, searchQuery]);

  useEffect(() => { loadProducts(); }, [selectedCategory]);

  const handleSearch = () => {
    if (searchQuery.trim()) loadProducts();
  };

  const handleClear = () => {
    setSearchQuery('');
    setSelectedCategory('');
    fetchProducts({ limit: 100 });
  };

  const toggleSort = () => {
    setShowSort((v) => {
      Animated.timing(sortAnim, {
        toValue: v ? 0 : 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      return !v;
    });
  };

  const sorted = [...products].sort((a, b) => {
    const pa = a.discountPrice ?? a.price;
    const pb = b.discountPrice ?? b.price;
    if (sortKey === 'price_asc') return pa - pb;
    if (sortKey === 'price_desc') return pb - pa;
    if (sortKey === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
    return 0;
  });

  const pageTitle = params.name
    ? params.name
    : searchQuery
    ? `"${searchQuery}"`
    : 'All Products';

  const renderProduct = ({ item }: { item: Product }) => {
    const price = item.discountPrice ?? item.price;
    const original = item.discountPrice ? item.price : null;
    const pct = original ? Math.round(((original - price) / original) * 100) : 0;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(customer)/product/${item._id}`)}
        activeOpacity={0.9}
      >
        <View style={styles.imgWrap}>
          <Image
            source={{ uri: item.images?.[0] ?? 'https://via.placeholder.com/150' }}
            style={styles.cardImg}
          />
          {pct > 0 && (
            <View style={styles.pctBadge}>
              <Text style={styles.pctText}>{pct}%</Text>
            </View>
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
          {(item.vendor?.name || item.shopId?.shopName) ? (
            <Text style={styles.cardVendor} numberOfLines={1}>
              {item.vendor?.name ?? item.shopId?.shopName}
            </Text>
          ) : null}
          <View style={styles.cardPriceRow}>
            <Text style={styles.cardPrice}>₹{price}</Text>
            {original && <Text style={styles.cardOriginal}>₹{original}</Text>}
          </View>
          {item.rating ? (
            <View style={styles.cardRating}>
              <Ionicons name="star" size={11} color="#FDCB6E" />
              <Text style={styles.cardRatingText}>{item.rating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{pageTitle}</Text>
        <TouchableOpacity
          style={styles.cartBtn}
          onPress={() => router.push('/(customer)/cart')}
        >
          <Ionicons name="cart-outline" size={22} color={Theme.colors.text} />
          {totalItems > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{totalItems > 9 ? '9+' : totalItems}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Search ── */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={17} color={Theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={Theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleClear}>
              <Ionicons name="close-circle" size={17} color={Theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.sortBtn} onPress={toggleSort}>
          <Ionicons name="funnel-outline" size={18} color={Theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Sort Dropdown ── */}
      {showSort && (
        <Animated.View style={[styles.sortDropdown, { opacity: sortAnim }]}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.sortOption, sortKey === opt.key && styles.sortOptionActive]}
              onPress={() => { setSortKey(opt.key); toggleSort(); }}
            >
              <Text style={[styles.sortOptionText, sortKey === opt.key && styles.sortOptionTextActive]}>
                {opt.label}
              </Text>
              {sortKey === opt.key && (
                <Ionicons name="checkmark" size={16} color={Theme.colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}

      {/* ── Category Pills ── */}
      {categories.length > 0 && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ _id: '', name: 'All' }, ...categories]}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.pillsRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.pill, selectedCategory === item._id && styles.pillActive]}
              onPress={() => setSelectedCategory(item._id)}
            >
              <Text style={[styles.pillText, selectedCategory === item._id && styles.pillTextActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* ── Result count + sort label ── */}
      <View style={styles.resultRow}>
        {loading ? null : (
          <Text style={styles.resultText}>
            {sorted.length} product{sorted.length !== 1 ? 's' : ''}
          </Text>
        )}
        {sortKey !== 'default' && (
          <Text style={styles.sortLabel}>
            {SORT_OPTIONS.find((o) => o.key === sortKey)?.label}
          </Text>
        )}
      </View>

      {/* ── Product Grid ── */}
      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item, i) => `${item._id}-${i}`}
          numColumns={2}
          renderItem={renderProduct}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="search-outline" size={64} color={Theme.colors.border} />
              <Text style={styles.emptyTitle}>No products found</Text>
              <Text style={styles.emptySub}>Try a different search or category</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={handleClear}>
                <Text style={styles.emptyBtnText}>Clear filters</Text>
              </TouchableOpacity>
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
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg, paddingVertical: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight,
    gap: Theme.spacing.sm,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },
  cartBtn: { padding: 4 },
  badge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: Theme.colors.danger,
    borderRadius: Theme.radius.full, minWidth: 16, height: 16,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2,
  },
  badgeText: { fontSize: 9, color: Theme.colors.white, fontWeight: '800' },

  searchRow: {
    flexDirection: 'row', gap: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg, paddingVertical: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm,
    backgroundColor: Theme.colors.surfaceSecondary,
    borderRadius: Theme.radius.md, paddingHorizontal: Theme.spacing.md, height: 44,
    borderWidth: 1, borderColor: Theme.colors.border,
  },
  searchInput: { flex: 1, fontSize: Theme.font.sm, color: Theme.colors.text },
  sortBtn: {
    width: 44, height: 44, borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.primarySurface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Theme.colors.primaryLight,
  },

  sortDropdown: {
    marginHorizontal: Theme.spacing.lg, marginTop: -4,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.md, ...Theme.shadow.md,
    overflow: 'hidden', zIndex: 10,
    borderWidth: 1, borderColor: Theme.colors.border,
  },
  sortOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg, paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight,
    
  },
  sortOptionActive: { backgroundColor: Theme.colors.primarySurface },
  sortOptionText: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary },
  sortOptionTextActive: { color: Theme.colors.primary, fontWeight: '600' },

  pillsRow: { paddingHorizontal: Theme.spacing.lg, paddingVertical: Theme.spacing.sm, gap: Theme.spacing.sm },
  pill: {
    paddingHorizontal: Theme.spacing.md, paddingVertical: 6,
    borderRadius: Theme.radius.full, borderWidth: 1.5, borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
    height: 35,
    marginBottom: 5,
  },
  pillActive: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  pillText: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, fontWeight: '500' },
  pillTextActive: { color: Theme.colors.white, fontWeight: '700' },

  resultRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg, paddingVertical: Theme.spacing.sm,
  },
  resultText: { fontSize: Theme.font.sm, color: Theme.colors.textMuted },
  sortLabel: { fontSize: Theme.font.sm, color: Theme.colors.primary, fontWeight: '500' },

  loaderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  gridContent: { paddingHorizontal: Theme.spacing.lg, paddingBottom: Theme.spacing.xxl },
  columnWrapper: { justifyContent: 'space-between', marginBottom: Theme.spacing.sm },

  card: {
    width: CARD_W,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    overflow: 'hidden',
    ...Theme.shadow.sm,
  },
  imgWrap: { position: 'relative' },
  cardImg: { width: '100%', height: CARD_W * 0.9 },
  pctBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: Theme.colors.danger,
    borderRadius: Theme.radius.full, paddingHorizontal: 7, paddingVertical: 2,
  },
  pctText: { fontSize: 10, color: Theme.colors.white, fontWeight: '800' },
  cardBody: { padding: Theme.spacing.sm },
  cardName: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.text, marginBottom: 2 },
  cardVendor: { fontSize: 11, color: Theme.colors.textMuted, marginBottom: 4 },
  cardPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  cardPrice: { fontSize: Theme.font.md, fontWeight: '800', color: Theme.colors.primary },
  cardOriginal: { fontSize: 11, color: Theme.colors.textMuted, textDecorationLine: 'line-through' },
  cardRating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardRatingText: { fontSize: 11, color: Theme.colors.textSecondary, fontWeight: '500' },

  emptyBox: { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text, marginTop: 16 },
  emptySub: { fontSize: Theme.font.sm, color: Theme.colors.textMuted, marginTop: 6, textAlign: 'center' },
  emptyBtn: {
    marginTop: Theme.spacing.xl, paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.md, backgroundColor: Theme.colors.primarySurface,
    borderRadius: Theme.radius.md, borderWidth: 1, borderColor: Theme.colors.primaryLight,
  },
  emptyBtnText: { fontSize: Theme.font.sm, color: Theme.colors.primary, fontWeight: '600' },
});