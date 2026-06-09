// app/(customer)/wishlist/page.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { Theme } from '../../constants/theme';

interface WishlistItem {
  _id: string;
  productId: string;
  name: string;
  price: number;
  image: string;
  // possibly other fields like originalPrice, discount, etc.
}

export default function WishlistScreen() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWishlist = async () => {
    try {
      const res = await api.get('/api/wishlist');
      setItems(res.data);
    } catch (error) {
      console.error('Failed to fetch wishlist:', error);
      Alert.alert('Error', 'Could not load wishlist');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchWishlist();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchWishlist();
  };

  const removeFromWishlist = async (productId: string) => {
    Alert.alert('Remove', 'Remove this item from wishlist?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/wishlist/${productId}`);
            // Remove locally for instant UI update
            setItems(prev => prev.filter(item => item.productId !== productId));
          } catch (error) {
            Alert.alert('Error', 'Failed to remove item');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: WishlistItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(customer)/product/${item.productId}`)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: item.image }} style={styles.image} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.price}>₹{item.price.toFixed(0)}</Text>
      </View>
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => removeFromWishlist(item.productId)}
      >
        <Ionicons name="trash-outline" size={22} color={Theme.colors.danger} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Wishlist</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Theme.colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={72} color={Theme.colors.border} />
              <Text style={styles.emptyTitle}>Wishlist is empty</Text>
              <Text style={styles.emptySub}>Save your favourite items here</Text>
              <TouchableOpacity
                style={styles.shopBtn}
                onPress={() => router.push('/(customer)/home')}
              >
                <Text style={styles.shopBtnText}>Start Shopping</Text>
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
  price: { fontSize: Theme.font.lg, fontWeight: '800', color: Theme.colors.primary },
  removeBtn: { padding: 8 },
  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: Theme.font.xl, fontWeight: '700', marginTop: 16, marginBottom: 6, color: Theme.colors.text },
  emptySub: { fontSize: Theme.font.sm, color: Theme.colors.textMuted, textAlign: 'center', marginBottom: 24 },
  shopBtn: { backgroundColor: Theme.colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Theme.radius.md },
  shopBtnText: { color: '#fff', fontWeight: '700', fontSize: Theme.font.md },
});