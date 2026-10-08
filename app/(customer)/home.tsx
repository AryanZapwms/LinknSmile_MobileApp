// app/(customer)/home.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProductStore } from '../../store/product.store';
import { useAuthStore } from '../../store/auth.store';
import { useCartStore } from '../../store/cart.store';
import { useFavouritesStore } from '../../store/favourites.store';
import { Theme } from '../../constants/theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.42;

export default function CustomerHomeScreen() {
  const { products, featuredProducts, categories, isCategoriesLoading, fetchProducts, fetchFeaturedProducts, fetchCategories } = useProductStore();
  const { user } = useAuthStore();
  const totalItems = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  const favouriteCount = useFavouritesStore((s) => s.productIds.length);
  const loadFavourites = useFavouritesStore((s) => s.load);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    await Promise.all([
      fetchProducts({ limit: 20 }),
      fetchFeaturedProducts(),
      fetchCategories(),
      loadFavourites().catch(() => {}), // for the heart badge
    ]);
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const firstName = user?.name?.split(' ')[0] || 'there';

  if (loading) {
    return (
      <View style={styles.loaderFull}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {firstName} 👋</Text>
          <Text style={styles.subGreeting}>What are you looking for?</Text>
        </View>
        <View style={styles.headerActions}>
          {/* Favourites */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push('/(customer)/favourites')}
          >
            <Ionicons name="heart-outline" size={24} color={Theme.colors.text} />
            {favouriteCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{favouriteCount > 9 ? '9+' : favouriteCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Cart Button */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push('/(customer)/cart')}
          >
            <Ionicons name="cart-outline" size={24} color={Theme.colors.text} />
            {totalItems > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{totalItems > 9 ? '9+' : totalItems}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Avatar / Profile */}
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => router.push('/(customer)/profile')}
          >
            {user?.image ? (
              <Image source={{ uri: user.image }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {(user?.name?.[0] ?? 'U').toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search Bar ── */}
      <TouchableOpacity
        style={styles.searchBar}
        onPress={() => router.push('/(customer)/product/list')}
        activeOpacity={0.8}
      >
        <Ionicons name="search-outline" size={18} color={Theme.colors.textMuted} />
        <Text style={styles.searchPlaceholder}>Search products, categories...</Text>
        <View style={styles.searchFilter}>
          <Ionicons name="options-outline" size={16} color={Theme.colors.primary} />
        </View>
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />}
      >
        {/* ── Promo Banner ── */}
        <TouchableOpacity
          style={styles.promoBanner}
          onPress={() => router.push('/(customer)/product/list')}
          activeOpacity={0.92}
        >
          <View style={styles.promoTextCol}>
            <View style={styles.promoBadge}>
              <Text style={styles.promoBadgeText}>LIMITED OFFER</Text>
            </View>
            <Text style={styles.promoTitle}>Summer Sale</Text>
            <Text style={styles.promoSubtitle}>Up to 50% off{'\n'}on selected items</Text>
            <View style={styles.promoBtn}>
              <Text style={styles.promoBtnText}>Shop Now</Text>
              <Ionicons name="arrow-forward" size={14} color={Theme.colors.primary} />
            </View>
          </View>
          <View style={styles.promoIllustration}>
            <Ionicons name="pricetags" size={80} color="rgba(255,255,255,0.25)" />
          </View>
        </TouchableOpacity>

        {/* ── Categories ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <TouchableOpacity onPress={() => router.push('/(customer)/product/list')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {isCategoriesLoading ? (
            <View style={styles.miniLoader}>
              <ActivityIndicator size="small" color={Theme.colors.primary} />
            </View>
          ) : categories.length > 0 ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={categories}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ paddingHorizontal: Theme.spacing.lg }}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.categoryChip}
                  onPress={() => router.push(`/(customer)/product/list?category=${item._id}&name=${item.name}`)}
                  activeOpacity={0.8}
                >
                  <View style={styles.categoryImgWrap}>
                    <Image
                      source={{ uri: item.image || 'https://via.placeholder.com/60' }}
                      style={styles.categoryImg}
                    />
                  </View>
                  <Text style={styles.categoryName} numberOfLines={1}>{item.name}</Text>
                  {item.productCount ? (
                    <Text style={styles.categoryCount}>{item.productCount}</Text>
                  ) : null}
                </TouchableOpacity>
              )}
            />
          ) : null}
        </View>

        {/* ── Featured Products ── */}
        {featuredProducts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Featured</Text>
              <TouchableOpacity onPress={() => router.push('/(customer)/product/list')}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={featuredProducts}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ paddingHorizontal: Theme.spacing.lg }}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.featuredCard}
                  onPress={() => router.push(`/(customer)/product/${item._id}`)}
                  activeOpacity={0.9}
                >
                  <Image
                    source={{ uri: item.images?.[0] || 'https://via.placeholder.com/200' }}
                    style={styles.featuredImg}
                  />
                  {item.discountPrice && (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountText}>
                        {Math.round(((item.price - item.discountPrice) / item.price) * 100)}% OFF
                      </Text>
                    </View>
                  )}
                  <View style={styles.featuredInfo}>
                    <Text style={styles.featuredName} numberOfLines={2}>{item.name}</Text>
                    <View style={styles.featuredPriceRow}>
                      <Text style={styles.featuredPrice}>
                        ₹{item.discountPrice ?? item.price}
                      </Text>
                      {item.discountPrice && (
                        <Text style={styles.featuredOriginal}>₹{item.price}</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* ── All Products Grid ── */}
        {products.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>All Products</Text>
              <TouchableOpacity onPress={() => router.push('/(customer)/product/list')}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.grid}>
              {products.slice(0, 10).map((item) => (
                <TouchableOpacity
                  key={item._id}
                  style={styles.gridCard}
                  onPress={() => router.push(`/(customer)/product/${item._id}`)}
                  activeOpacity={0.9}
                >
                  <Image
                    source={{ uri: item.images?.[0] || 'https://via.placeholder.com/150' }}
                    style={styles.gridImg}
                  />
                  {item.discountPrice && (
                    <View style={styles.gridBadge}>
                      <Text style={styles.gridBadgeText}>SALE</Text>
                    </View>
                  )}
                  <View style={styles.gridInfo}>
                    <Text style={styles.gridName} numberOfLines={2}>{item.name}</Text>
                    {(item.vendor?.name || item.shopId?.shopName) ? (
                      <Text style={styles.gridVendor} numberOfLines={1}>
                        {item.vendor?.name ?? item.shopId?.shopName}
                      </Text>
                    ) : null}
                    <View style={styles.gridPriceRow}>
                      <Text style={styles.gridPrice}>
                        ₹{item.discountPrice ?? item.price}
                      </Text>
                      {item.discountPrice && (
                        <Text style={styles.gridOriginal}>₹{item.price}</Text>
                      )}
                    </View>
                    {item.rating ? (
                      <View style={styles.ratingRow}>
                        <Ionicons name="star" size={11} color="#FDCB6E" />
                        <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {products.length > 10 && (
              <TouchableOpacity
                style={styles.viewAllBtn}
                onPress={() => router.push('/(customer)/product/list')}
              >
                <Text style={styles.viewAllText}>View all {products.length} products</Text>
                <Ionicons name="arrow-forward" size={16} color={Theme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// styles remain unchanged (same as your original)
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  loaderFull: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg, paddingTop: Theme.spacing.md, paddingBottom: Theme.spacing.sm,
    backgroundColor: Theme.colors.surface,
  },
  greeting: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },
  subGreeting: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Theme.colors.surfaceSecondary,
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: Theme.colors.danger,
    borderRadius: Theme.radius.full, minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: Theme.colors.surface,
  },
  badgeText: { fontSize: 10, color: Theme.colors.white, fontWeight: '800' },
  avatarBtn: { marginLeft: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Theme.colors.border },
  avatarFallback: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Theme.colors.primarySurface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Theme.colors.primaryLight,
  },
  avatarInitial: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.primary },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    marginHorizontal: Theme.spacing.lg, marginVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md, height: 46,
    borderRadius: Theme.radius.lg, borderWidth: 1.5, borderColor: Theme.colors.border,
    gap: Theme.spacing.sm,
  },
  searchPlaceholder: { flex: 1, fontSize: Theme.font.sm, color: Theme.colors.textMuted },
  searchFilter: {
    width: 30, height: 30, borderRadius: Theme.radius.sm,
    backgroundColor: Theme.colors.primarySurface,
    justifyContent: 'center', alignItems: 'center',
  },
  promoBanner: {
    marginHorizontal: Theme.spacing.lg, marginBottom: Theme.spacing.sm,
    borderRadius: Theme.radius.xl, overflow: 'hidden',
    backgroundColor: Theme.colors.primary,
    flexDirection: 'row', padding: Theme.spacing.xl,
    minHeight: 140, ...Theme.shadow.md,
  },
  promoTextCol: { flex: 1, justifyContent: 'space-between' },
  promoBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: Theme.radius.full, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8,
  },
  promoBadgeText: { fontSize: 10, color: Theme.colors.white, fontWeight: '700', letterSpacing: 1 },
  promoTitle: { fontSize: Theme.font.xxl, fontWeight: '800', color: Theme.colors.white },
  promoSubtitle: { fontSize: Theme.font.sm, color: 'rgba(255,255,255,0.85)', lineHeight: 20, marginTop: 4 },
  promoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: Theme.colors.white, borderRadius: Theme.radius.full,
    paddingHorizontal: Theme.spacing.md, paddingVertical: 6, marginTop: Theme.spacing.md,
  },
  promoBtnText: { fontSize: Theme.font.sm, color: Theme.colors.primary, fontWeight: '700' },
  promoIllustration: { justifyContent: 'center', alignItems: 'center', width: 80 },
  section: { marginTop: Theme.spacing.xxl },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg, marginBottom: Theme.spacing.md,
  },
  sectionTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },
  seeAll: { fontSize: Theme.font.sm, color: Theme.colors.primary, fontWeight: '600' },
  miniLoader: { height: 90, justifyContent: 'center', alignItems: 'center' },
  categoryChip: { alignItems: 'center', width: 72 },
  categoryImgWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Theme.colors.primarySurface,
    overflow: 'hidden', marginBottom: 6,
    borderWidth: 1.5, borderColor: Theme.colors.border,
  },
  categoryImg: { width: '100%', height: '100%' },
  categoryName: { fontSize: 11, color: Theme.colors.text, fontWeight: '500', textAlign: 'center' },
  categoryCount: { fontSize: 10, color: Theme.colors.textMuted, marginTop: 1 },
  featuredCard: {
    width: CARD_WIDTH, backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg, overflow: 'hidden', ...Theme.shadow.sm,
  },
  featuredImg: { width: '100%', height: CARD_WIDTH * 0.85 },
  discountBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: Theme.colors.danger,
    borderRadius: Theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  discountText: { fontSize: 10, color: Theme.colors.white, fontWeight: '800' },
  featuredInfo: { padding: Theme.spacing.sm },
  featuredName: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.text, marginBottom: 4 },
  featuredPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featuredPrice: { fontSize: Theme.font.md, fontWeight: '800', color: Theme.colors.primary },
  featuredOriginal: { fontSize: Theme.font.xs, color: Theme.colors.textMuted, textDecorationLine: 'line-through' },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: Theme.spacing.md, gap: Theme.spacing.sm,
  },
  gridCard: {
    width: (width - Theme.spacing.md * 2 - Theme.spacing.sm) / 2,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg, overflow: 'hidden', ...Theme.shadow.sm,
  },
  gridImg: { width: '100%', height: 150 },
  gridBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: Theme.colors.success,
    borderRadius: Theme.radius.full, paddingHorizontal: 7, paddingVertical: 2,
  },
  gridBadgeText: { fontSize: 9, color: Theme.colors.white, fontWeight: '800', letterSpacing: 0.5 },
  gridInfo: { padding: Theme.spacing.sm },
  gridName: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.text, marginBottom: 2 },
  gridVendor: { fontSize: 11, color: Theme.colors.textMuted, marginBottom: 4 },
  gridPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  gridPrice: { fontSize: Theme.font.md, fontWeight: '800', color: Theme.colors.primary },
  gridOriginal: { fontSize: 11, color: Theme.colors.textMuted, textDecorationLine: 'line-through' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 11, color: Theme.colors.textSecondary, fontWeight: '500' },
  viewAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: Theme.spacing.lg, marginHorizontal: Theme.spacing.lg,
    backgroundColor: Theme.colors.primarySurface,
    borderRadius: Theme.radius.md, paddingVertical: Theme.spacing.md,
    borderWidth: 1, borderColor: Theme.colors.primaryLight,
  },
  viewAllText: { fontSize: Theme.font.sm, color: Theme.colors.primary, fontWeight: '600' },
});