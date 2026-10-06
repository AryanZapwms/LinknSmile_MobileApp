// app/(customer)/favourites.tsx
// The user's favourite products: the same list the website shows under
// Profile → Favourites (GET/POST /api/favourites). The server keeps only
// references, so product details come from /api/products?ids=…
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ProductSummary } from '../../contracts';
import { apiClient } from '../../services/api-client';
import { errorMessage } from '../../services/api-error';
import { useFavouritesStore } from '../../store/favourites.store';
import { formatMoney } from '../../utils/money';
import { Theme } from '../../constants/theme';

/** /api/products returns at most 100 products per request. */
const PAGE_SIZE = 100;

async function fetchProducts(ids: string[]): Promise<ProductSummary[]> {
  const products: ProductSummary[] = [];
  for (let start = 0; start < ids.length; start += PAGE_SIZE) {
    const chunk = ids.slice(start, start + PAGE_SIZE);
    const page = await apiClient.products.list({ ids: chunk.join(','), limit: PAGE_SIZE });
    products.push(...page.products);
  }
  return products;
}

export default function FavouritesScreen() {
  const loadFavourites = useFavouritesStore((s) => s.load);
  const toggleProduct = useFavouritesStore((s) => s.toggleProduct);
  const favouriteIds = useFavouritesStore((s) => s.productIds);

  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      await loadFavourites();
      const ids = useFavouritesStore.getState().productIds;
      setProducts(ids.length ? await fetchProducts(ids) : []);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your favourites.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadFavourites]);

  // Reload whenever the screen is opened: favourites can change on the
  // product page or on the website.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleRemove = (product: ProductSummary) => {
    Alert.alert('Remove', `Remove ${product.name} from your favourites?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await toggleProduct(product._id);
          } catch (err) {
            Alert.alert('Error', errorMessage(err, 'Could not update favourites.'));
          }
        },
      },
    ]);
  };

  // Products that were unfavourited (here or elsewhere) drop out immediately;
  // ones that are no longer on sale are simply not returned by the server.
  const visible = products.filter((product) => favouriteIds.includes(product._id));

  const renderItem = ({ item }: { item: ProductSummary }) => {
    const image = item.images?.[0] ?? item.image ?? undefined;
    const price = item.discountPrice || item.price;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(customer)/product/${item._id}`)}
        activeOpacity={0.8}
      >
        <Image source={image ? { uri: image } : undefined} style={styles.image} />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatMoney(price)}</Text>
            {item.discountPrice ? <Text style={styles.originalPrice}>{formatMoney(item.price)}</Text> : null}
          </View>
          {item.stock === 0 && <Text style={styles.outOfStock}>Out of stock</Text>}
        </View>
        <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(item)}>
          <Ionicons name="heart" size={22} color={Theme.colors.danger} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Favourites</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Theme.colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={visible}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void load(); }}
              tintColor={Theme.colors.primary}
            />
          }
          ListEmptyComponent={
            error ? (
              <View style={styles.empty}>
                <Ionicons name="cloud-offline-outline" size={64} color={Theme.colors.border} />
                <Text style={styles.emptyTitle}>Couldn&apos;t load favourites</Text>
                <Text style={styles.emptySub}>{error}</Text>
                <TouchableOpacity style={styles.shopBtn} onPress={() => { setLoading(true); void load(); }}>
                  <Text style={styles.shopBtnText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="heart-outline" size={72} color={Theme.colors.border} />
                <Text style={styles.emptyTitle}>No favourites yet</Text>
                <Text style={styles.emptySub}>Tap the heart on a product to save it here</Text>
                <TouchableOpacity style={styles.shopBtn} onPress={() => router.push('/(customer)/home')}>
                  <Text style={styles.shopBtnText}>Start Shopping</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.lg, paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight,
  },
  headerTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: Theme.spacing.lg, paddingBottom: 32 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md,
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.md, marginBottom: Theme.spacing.md,
    borderWidth: 1, borderColor: Theme.colors.borderLight, ...Theme.shadow.sm,
  },
  image: { width: 70, height: 70, borderRadius: Theme.radius.md, backgroundColor: Theme.colors.surfaceSecondary },
  info: { flex: 1, gap: 4 },
  name: { fontSize: Theme.font.md, fontWeight: '600', color: Theme.colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  price: { fontSize: Theme.font.lg, fontWeight: '800', color: Theme.colors.primary },
  originalPrice: { fontSize: Theme.font.sm, color: Theme.colors.textMuted, textDecorationLine: 'line-through' },
  outOfStock: { fontSize: Theme.font.xs, color: Theme.colors.danger, fontWeight: '600' },
  removeBtn: { padding: 8 },
  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: Theme.font.xl, fontWeight: '700', marginTop: 16, marginBottom: 6, color: Theme.colors.text },
  emptySub: { fontSize: Theme.font.sm, color: Theme.colors.textMuted, textAlign: 'center', marginBottom: 24 },
  shopBtn: { backgroundColor: Theme.colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Theme.radius.md },
  shopBtnText: { color: '#fff', fontWeight: '700', fontSize: Theme.font.md },
});
