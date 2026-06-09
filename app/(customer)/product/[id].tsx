// app/(customer)/product/[id].tsx
// ADDED: Review submission section at bottom of reviews list
// Users can rate and submit a review directly from the product page
// Shows pending state after submission

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, Dimensions,
  Alert, Share, FlatList, Modal, Linking, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore, CartItem } from '../../../store/cart.store';
import { api } from '../../../services/api';
import { storage } from '../../../utils/storage';
import { Theme } from '../../../constants/theme';
import { useWishlistStore } from '../../../store/wishlist.store';

const { width } = Dimensions.get('window');

interface ProductDetails {
  _id: string;
  name: string;
  description: string;
  price: number;
  discountPrice?: number;
  images: string[];
  category: { _id: string; name: string } | null;
  shopId?: { _id: string; shopName: string; logo?: string; rating?: number };
  vendor?: { _id: string; name: string };
  stock: number;
  rating?: number;
  reviews?: Review[];
  specifications?: Record<string, string>;
  sizes?: { size: string; stock: number }[];
  colors?: { name: string; hex: string; stock: number }[];
  createdAt: string;
}

interface Review {
  _id: string;
  user: { _id: string; name: string; avatar?: string };
  userName?: string;
  rating: number;
  comment: string;
  createdAt: string;
  isVerifiedBuyer?: boolean;
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isInWishlist, addItem, removeItem, fetchWishlist } = useWishlistStore();
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // Review state
  const [userRating, setUserRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useEffect(() => {
    fetchProduct();
    fetchWishlist();
    fetchReviews();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const res = await api.get(`/api/products/${id}`);
      setProduct(res.data);
      if (res.data.sizes?.length) setSelectedSize(res.data.sizes[0].size);
      if (res.data.colors?.length) setSelectedColor(res.data.colors[0].name);
    } catch {
      Alert.alert('Error', 'Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const res = await api.get(`/api/products/${id}/reviews`);
      if (res.data.success) {
        setReviews(res.data.reviews || []);
      }
    } catch (err) {
      // Non-critical — product still shows without reviews
      console.log('Reviews fetch failed:', err);
    }
  };

  const handleSubmitReview = async () => {
    const token = await storage.getToken();
    if (!token) {
      Alert.alert('Login Required', 'Please sign in to leave a review', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/auth/login') },
      ]);
      return;
    }

    if (userRating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating');
      return;
    }
    if (reviewComment.trim().length < 10) {
      Alert.alert('Review Too Short', 'Please write at least 10 characters');
      return;
    }

    setSubmittingReview(true);
    try {
      const res = await api.post(`/api/products/${id}/reviews`, {
        rating: userRating,
        comment: reviewComment.trim(),
      });
      if (res.data.success) {
        setReviewSubmitted(true);
        setUserRating(0);
        setReviewComment('');
        Alert.alert(
          'Review Submitted! 🎉',
          res.data.message || 'Your review has been submitted and will appear after moderation.'
        );
      }
    } catch (err: any) {
      const msg = err.response?.data?.error ?? 'Failed to submit review. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmittingReview(false);
    }
  };

  const isWishlisted = isInWishlist(id || '');

  const toggleWishlist = async () => {
    if (wishlistLoading) return;
    setWishlistLoading(true);
    const success = isWishlisted ? await removeItem(id!) : await addItem(id!);
    if (!success) Alert.alert('Error', 'Failed to update wishlist');
    setWishlistLoading(false);
  };

  const handleAddToCart = async () => {
    if (!product) return;

    if (!useCartStore.getState()._hasHydrated) {
      await new Promise<void>((resolve) => {
        const unsub = useCartStore.subscribe((s) => {
          if (s._hasHydrated) { unsub(); resolve(); }
        });
      });
    }

    if (product.stock === 0) {
      Alert.alert('Out of Stock', 'This product is currently out of stock.');
      return;
    }

    let currentStock = product.stock;
    if (selectedSize && product.sizes) {
      currentStock = product.sizes.find(s => s.size === selectedSize)?.stock || 0;
    }
    if (selectedColor && product.colors) {
      currentStock = product.colors.find(c => c.name === selectedColor)?.stock || 0;
    }
    if (currentStock === 0) {
      Alert.alert('Out of Stock', 'Selected variant is out of stock.');
      return;
    }

    const cartStore = useCartStore.getState();
    if (cartStore.getTotalItems() >= 5) {
      setShowBulkModal(true);
      return;
    }

    const existingItem = cartStore.items.find(
      item => item.productId === product._id &&
              item.selectedSize === selectedSize &&
              item.selectedColor === selectedColor
    );
    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (newQty > currentStock) {
        Alert.alert('Max Stock', `Only ${currentStock} items available.`);
        return;
      }
      cartStore.updateQuantity(product._id, newQty, selectedSize, selectedColor);
      Alert.alert('Quantity Updated', `${product.name} quantity increased to ${newQty}`);
      return;
    }

    setAddingToCart(true);
    const item: CartItem = {
      productId: product._id,
      name: product.name,
      price: product.price,
      discountPrice: product.discountPrice,
      quantity,
      image: product.images?.[0] ?? 'https://via.placeholder.com/150',
      stock: currentStock,
      shopId: product.shopId?._id,
      shopName: product.shopId?.shopName,
      vendorId: product.vendor?._id,
      vendorName: product.vendor?.name,
      selectedSize,
      selectedColor,
    };
    cartStore.addItem(item);
    setAddingToCart(false);

    Alert.alert('Added to Cart ✅', `${product.name} added to your cart.`, [
      { text: 'Keep Shopping', style: 'cancel' },
      { text: 'View Cart', onPress: () => router.push('/(customer)/cart') },
    ]);
  };

  const handleBuyNow = async () => {
    if (!product || product.stock === 0) return;
    const token = await storage.getToken();
    if (!token) {
      Alert.alert('Login Required', 'Please sign in to proceed', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/auth/login') },
      ]);
      return;
    }

    let currentStock = product.stock;
    if (selectedSize && product.sizes) {
      currentStock = product.sizes.find(s => s.size === selectedSize)?.stock || 0;
    }
    if (selectedColor && product.colors) {
      currentStock = product.colors.find(c => c.name === selectedColor)?.stock || 0;
    }
    if (currentStock === 0) {
      Alert.alert('Out of Stock', 'Selected variant is out of stock.');
      return;
    }

    const item: CartItem = {
      productId: product._id,
      name: product.name,
      price: product.price,
      discountPrice: product.discountPrice,
      quantity,
      image: product.images?.[0] ?? '',
      stock: currentStock,
      shopId: product.shopId?._id,
      shopName: product.shopId?.shopName,
      selectedSize,
      selectedColor,
    };
    useCartStore.getState().clearCart();
    useCartStore.getState().addItem(item);
    router.push('/(customer)/checkout');
  };

  const handleShare = async () => {
    if (!product) return;
    await Share.share({
      message: `Check out ${product.name} on LinkAndSmile!\nPrice: ₹${product.discountPrice ?? product.price}\n${product.description?.slice(0, 100)}...`,
      url: `https://linkn-smile.vercel.app/products/${product._id}`,
    });
  };

  const renderStars = (rating = 0, showNumber = false) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons
          key={s}
          name={s <= rating ? 'star' : s <= rating + 0.5 ? 'star-half' : 'star-outline'}
          size={15}
          color="#FDCB6E"
        />
      ))}
      {showNumber && <Text style={styles.ratingNum}>({rating.toFixed(1)})</Text>}
    </View>
  );

  const renderRatingBreakdown = () => {
    if (!reviews.length) return null;
    const total = reviews.length;
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => { counts[r.rating] = (counts[r.rating] || 0) + 1; });
    const avgRating = reviews.reduce((s, r) => s + r.rating, 0) / total;

    return (
      <View style={styles.ratingBreakdown}>
        <Text style={styles.breakdownTitle}>Rating Breakdown</Text>
        <View style={styles.ratingOverview}>
          <Text style={styles.avgRatingNum}>{avgRating.toFixed(1)}</Text>
          {renderStars(avgRating)}
          <Text style={styles.ratingTotalCount}>{total} reviews</Text>
        </View>
        {[5, 4, 3, 2, 1].map(star => (
          <View key={star} style={styles.breakdownRow}>
            <Text style={styles.breakdownStar}>{star} ★</Text>
            <View style={styles.breakdownBarBg}>
              <View style={[styles.breakdownBar, { width: `${((counts[star] || 0) / total) * 100}%` as any }]} />
            </View>
            <Text style={styles.breakdownCount}>{counts[star] || 0}</Text>
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loaderCenter}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loaderCenter}>
          <Ionicons name="alert-circle-outline" size={52} color={Theme.colors.border} />
          <Text style={styles.errorText}>Product not found</Text>
          <TouchableOpacity style={styles.goBackBtn} onPress={() => router.back()}>
            <Text style={styles.goBackBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const displayPrice = product.discountPrice ?? product.price;
  const originalPrice = product.discountPrice ? product.price : null;
  const discountPct = originalPrice
    ? Math.round(((originalPrice - displayPrice) / originalPrice) * 100)
    : 0;

  let availableStock = product.stock;
  if (selectedSize && product.sizes) {
    availableStock = product.sizes.find(s => s.size === selectedSize)?.stock || 0;
  }
  if (selectedColor && product.colors) {
    availableStock = product.colors.find(c => c.name === selectedColor)?.stock || 0;
  }

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : product.rating ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        <View style={styles.gallery}>
          <View style={styles.galleryTopBar}>
            <TouchableOpacity style={styles.galleryBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color={Theme.colors.text} />
            </TouchableOpacity>
            <View style={styles.galleryActions}>
              <TouchableOpacity style={styles.galleryBtn} onPress={handleShare}>
                <Ionicons name="share-outline" size={20} color={Theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.galleryBtn} onPress={toggleWishlist} disabled={wishlistLoading}>
                <Ionicons
                  name={isWishlisted ? 'heart' : 'heart-outline'}
                  size={20}
                  color={isWishlisted ? Theme.colors.danger : Theme.colors.text}
                />
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            data={product.images?.length ? product.images : ['https://via.placeholder.com/400']}
            horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setSelectedImage(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={styles.mainImage} resizeMode="cover" />
            )}
            keyExtractor={(_, i) => String(i)}
          />

          {product.images?.length > 1 && (
            <View style={styles.dotsRow}>
              {product.images.map((_, i) => (
                <View key={i} style={[styles.dot, i === selectedImage && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.info}>
          {product.category && (
            <TouchableOpacity
              onPress={() => router.push(
                `/(customer)/product/list?category=${product.category?._id}&name=${product.category?.name}` as any
              )}
            >
              <Text style={styles.category}>{product.category.name}</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.name}>{product.name}</Text>

          {(avgRating > 0 || reviews.length > 0) && (
            <View style={styles.ratingRow}>
              {renderStars(avgRating, true)}
              {reviews.length > 0 && (
                <Text style={styles.reviewCount}>· {reviews.length} reviews</Text>
              )}
            </View>
          )}

          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{displayPrice}</Text>
            {originalPrice && (
              <>
                <Text style={styles.originalPrice}>₹{originalPrice}</Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>{discountPct}% OFF</Text>
                </View>
              </>
            )}
          </View>
          <Text style={styles.taxInfo}>* Inclusive of all taxes | Shipping calculated at checkout</Text>

          {/* Sizes */}
          {product.sizes && product.sizes.length > 0 && (
            <View style={styles.variantSection}>
              <Text style={styles.variantLabel}>Size</Text>
              <View style={styles.variantOptions}>
                {product.sizes.map((size) => (
                  <TouchableOpacity
                    key={size.size}
                    style={[
                      styles.variantChip,
                      selectedSize === size.size && styles.variantChipActive,
                      size.stock === 0 && styles.variantChipDisabled,
                    ]}
                    onPress={() => size.stock > 0 && setSelectedSize(size.size)}
                    disabled={size.stock === 0}
                  >
                    <Text style={[
                      styles.variantChipText,
                      selectedSize === size.size && styles.variantChipTextActive,
                      size.stock === 0 && styles.variantChipTextDisabled,
                    ]}>
                      {size.size}
                    </Text>
                    {size.stock === 0 && <Text style={styles.outOfStockLabel}>Out</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Colors */}
          {product.colors && product.colors.length > 0 && (
            <View style={styles.variantSection}>
              <Text style={styles.variantLabel}>Color</Text>
              <View style={styles.variantOptions}>
                {product.colors.map((color) => (
                  <TouchableOpacity
                    key={color.name}
                    style={[
                      styles.colorChip, { backgroundColor: color.hex },
                      selectedColor === color.name && styles.colorChipActive,
                      color.stock === 0 && styles.colorChipDisabled,
                    ]}
                    onPress={() => color.stock > 0 && setSelectedColor(color.name)}
                    disabled={color.stock === 0}
                  >
                    {selectedColor === color.name && (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <Text style={[styles.stock, availableStock > 0 ? styles.inStock : styles.outOfStock]}>
            {availableStock > 0 ? `✓ In Stock (${availableStock} left)` : '✗ Out of Stock'}
          </Text>

          {availableStock > 0 && (
            <View style={styles.qtyRow}>
              <Text style={styles.qtyLabel}>Quantity</Text>
              <View style={styles.qtySelector}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1}>
                  <Ionicons name="remove" size={18} color={quantity <= 1 ? Theme.colors.border : Theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{quantity}</Text>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => {
                    if (quantity < availableStock) setQuantity(q => q + 1);
                    else Alert.alert('Max Stock', `Only ${availableStock} items available`);
                  }}
                  disabled={quantity >= availableStock}
                >
                  <Ionicons name="add" size={18} color={quantity >= availableStock ? Theme.colors.border : Theme.colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{product.description}</Text>
          </View>

          {/* Seller */}
          {product.shopId && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Seller</Text>
              <TouchableOpacity style={styles.sellerCard} onPress={() => router.push(`/shop/${product.shopId?._id}` as any)}>
                {product.shopId.logo ? (
                  <Image source={{ uri: product.shopId.logo }} style={styles.sellerLogo} />
                ) : (
                  <View style={styles.sellerLogoFallback}>
                    <Ionicons name="storefront" size={22} color={Theme.colors.primary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.sellerName}>{product.shopId.shopName}</Text>
                  {product.shopId.rating != null && renderStars(product.shopId.rating)}
                </View>
                <Ionicons name="chevron-forward" size={18} color={Theme.colors.border} />
              </TouchableOpacity>
            </View>
          )}

          {/* Specs */}
          {product.specifications && Object.keys(product.specifications).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Specifications</Text>
              <View style={styles.specsTable}>
                {Object.entries(product.specifications).map(([k, v]) => (
                  <View key={k} style={styles.specRow}>
                    <Text style={styles.specKey}>{k}</Text>
                    <Text style={styles.specVal}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Rating breakdown */}
          {reviews.length > 0 && renderRatingBreakdown()}

          {/* Customer Reviews */}
          {reviews.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Customer Reviews</Text>
              {reviews.slice(0, 3).map((review) => (
                <View key={review._id} style={styles.reviewCard}>
                  <View style={styles.reviewTop}>
                    <View style={styles.reviewUser}>
                      <View style={styles.reviewAvatarFallback}>
                        <Text style={styles.reviewAvatarInitial}>
                          {(review.userName || review.user?.name || '?')[0].toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.reviewName}>{review.userName || review.user?.name}</Text>
                        <Text style={styles.reviewDate}>
                          {new Date(review.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </Text>
                      </View>
                    </View>
                    {renderStars(review.rating)}
                  </View>
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                  {review.isVerifiedBuyer && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={12} color={Theme.colors.success} />
                      <Text style={styles.verifiedText}>Verified Buyer</Text>
                    </View>
                  )}
                </View>
              ))}
              {reviews.length > 3 && (
                <TouchableOpacity style={styles.viewAllReviews}>
                  <Text style={styles.viewAllReviewsText}>View all {reviews.length} reviews</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Write a Review ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Write a Review</Text>
            {reviewSubmitted ? (
              <View style={styles.reviewSuccessCard}>
                <Ionicons name="checkmark-circle" size={32} color={Theme.colors.success} />
                <Text style={styles.reviewSuccessTitle}>Review Submitted!</Text>
                <Text style={styles.reviewSuccessText}>
                  Thanks for your feedback. Your review will appear after our team approves it.
                </Text>
              </View>
            ) : (
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.reviewForm}>
                  <Text style={styles.reviewFormLabel}>Your Rating</Text>
                  <View style={styles.starSelector}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <TouchableOpacity key={s} onPress={() => setUserRating(s)}>
                        <Ionicons
                          name={s <= userRating ? 'star' : 'star-outline'}
                          size={32}
                          color={s <= userRating ? '#FDCB6E' : Theme.colors.border}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.reviewFormLabel}>Your Review</Text>
                  <TextInput
                    style={styles.reviewInput}
                    placeholder="Share your experience with this product..."
                    placeholderTextColor={Theme.colors.textMuted}
                    value={reviewComment}
                    onChangeText={setReviewComment}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                  <TouchableOpacity
                    style={[
                      styles.submitReviewBtn,
                      (submittingReview || userRating === 0 || reviewComment.trim().length < 10) &&
                        styles.submitReviewBtnDisabled,
                    ]}
                    onPress={handleSubmitReview}
                    disabled={submittingReview || userRating === 0 || reviewComment.trim().length < 10}
                  >
                    {submittingReview
                      ? <ActivityIndicator color={Theme.colors.white} size="small" />
                      : (
                        <>
                          <Ionicons name="send-outline" size={16} color={Theme.colors.white} />
                          <Text style={styles.submitReviewText}>Submit Review</Text>
                        </>
                      )
                    }
                  </TouchableOpacity>
                  <Text style={styles.reviewDisclaimer}>
                    Reviews are moderated and will appear once approved.
                  </Text>
                </View>
              </KeyboardAvoidingView>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      {availableStock > 0 && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.addToCartBtn}
            onPress={handleAddToCart}
            disabled={addingToCart}
            activeOpacity={0.85}
          >
            {addingToCart
              ? <ActivityIndicator size="small" color={Theme.colors.white} />
              : (
                <>
                  <Ionicons name="cart-outline" size={18} color={Theme.colors.white} />
                  <Text style={styles.addToCartText}>Add to Cart</Text>
                </>
              )
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.buyNowBtn}
            onPress={handleBuyNow}
            disabled={addingToCart}
            activeOpacity={0.85}
          >
            <Text style={styles.buyNowText}>Buy Now</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bulk Order Modal */}
      <Modal visible={showBulkModal} transparent animationType="slide" onRequestClose={() => setShowBulkModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="bulb-outline" size={32} color={Theme.colors.warning} />
            </View>
            <Text style={styles.modalTitle}>Need a bulk order?</Text>
            <Text style={styles.modalSub}>You've hit the 5-item limit. Contact us for bulk pricing.</Text>
            <TouchableOpacity style={styles.modalCallBtn} onPress={() => Linking.openURL('tel:+919820623835')}>
              <Ionicons name="call-outline" size={18} color={Theme.colors.white} />
              <Text style={styles.modalCallText}>Call +91 9820623835</Text>
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
  errorText: { fontSize: Theme.font.md, color: Theme.colors.textSecondary },
  goBackBtn: { backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.md, paddingHorizontal: Theme.spacing.xl, paddingVertical: Theme.spacing.md },
  goBackBtnText: { color: Theme.colors.white, fontWeight: '700' },

  gallery: { position: 'relative', backgroundColor: Theme.colors.surfaceSecondary },
  galleryTopBar: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 },
  galleryActions: { flexDirection: 'row', gap: Theme.spacing.sm },
  galleryBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', alignItems: 'center', ...Theme.shadow.sm },
  mainImage: { width, height: width },
  dotsRow: { position: 'absolute', bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { width: 18, backgroundColor: Theme.colors.white },

  info: { padding: Theme.spacing.lg },
  category: { fontSize: Theme.font.sm, color: Theme.colors.primary, fontWeight: '600', marginBottom: 6 },
  name: { fontSize: Theme.font.xxl, fontWeight: '800', color: Theme.colors.text, marginBottom: 8, lineHeight: 30 },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Theme.spacing.md },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingNum: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, marginLeft: 3 },
  reviewCount: { fontSize: Theme.font.sm, color: Theme.colors.textMuted },

  priceRow: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm, marginBottom: 4 },
  price: { fontSize: 28, fontWeight: '800', color: Theme.colors.primary },
  originalPrice: { fontSize: Theme.font.lg, color: Theme.colors.textMuted, textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: Theme.colors.danger, borderRadius: Theme.radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  discountBadgeText: { fontSize: 11, color: Theme.colors.white, fontWeight: '800' },
  taxInfo: { fontSize: 11, color: Theme.colors.textMuted, marginBottom: Theme.spacing.md },

  variantSection: { marginBottom: Theme.spacing.lg },
  variantLabel: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.text, marginBottom: 8 },
  variantOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  variantChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Theme.radius.full, borderWidth: 1.5, borderColor: Theme.colors.border, backgroundColor: Theme.colors.surface },
  variantChipActive: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  variantChipDisabled: { opacity: 0.5, backgroundColor: Theme.colors.surfaceSecondary },
  variantChipText: { fontSize: Theme.font.sm, fontWeight: '500', color: Theme.colors.text },
  variantChipTextActive: { color: Theme.colors.white },
  variantChipTextDisabled: { color: Theme.colors.textMuted },
  colorChip: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: Theme.colors.border, justifyContent: 'center', alignItems: 'center' },
  colorChipActive: { borderColor: Theme.colors.primary, borderWidth: 3 },
  colorChipDisabled: { opacity: 0.4 },
  outOfStockLabel: { fontSize: 9, color: Theme.colors.danger, marginLeft: 4 },

  stock: { fontSize: Theme.font.sm, fontWeight: '600', marginBottom: Theme.spacing.lg },
  inStock: { color: Theme.colors.success },
  outOfStock: { color: Theme.colors.danger },

  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.lg, marginBottom: Theme.spacing.xxl },
  qtyLabel: { fontSize: Theme.font.md, color: Theme.colors.text, fontWeight: '600' },
  qtySelector: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: Theme.colors.border, borderRadius: Theme.radius.md, overflow: 'hidden' },
  qtyBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.surfaceSecondary },
  qtyText: { width: 48, textAlign: 'center', fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.text },

  section: { marginTop: Theme.spacing.xxl, paddingTop: Theme.spacing.xxl, borderTopWidth: 1, borderTopColor: Theme.colors.borderLight },
  sectionTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text, marginBottom: Theme.spacing.md },
  description: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, lineHeight: 22 },

  sellerCard: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md, backgroundColor: Theme.colors.surfaceSecondary, borderRadius: Theme.radius.lg, padding: Theme.spacing.md },
  sellerLogo: { width: 48, height: 48, borderRadius: 24 },
  sellerLogoFallback: { width: 48, height: 48, borderRadius: 24, backgroundColor: Theme.colors.primarySurface, justifyContent: 'center', alignItems: 'center' },
  sellerName: { fontSize: Theme.font.md, fontWeight: '600', color: Theme.colors.text, marginBottom: 4 },

  specsTable: { backgroundColor: Theme.colors.surfaceSecondary, borderRadius: Theme.radius.md, overflow: 'hidden' },
  specRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: Theme.spacing.md, borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight },
  specKey: { flex: 1, fontSize: Theme.font.sm, color: Theme.colors.textSecondary, fontWeight: '600' },
  specVal: { flex: 2, fontSize: Theme.font.sm, color: Theme.colors.text },

  ratingBreakdown: { marginTop: Theme.spacing.lg, paddingHorizontal: 4 },
  ratingOverview: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  avgRatingNum: { fontSize: 28, fontWeight: '800', color: Theme.colors.text },
  ratingTotalCount: { fontSize: Theme.font.sm, color: Theme.colors.textMuted },
  breakdownTitle: { fontSize: Theme.font.md, fontWeight: '600', marginBottom: 8, color: Theme.colors.text },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  breakdownStar: { width: 40, fontSize: 12, fontWeight: '500', color: Theme.colors.textSecondary },
  breakdownBarBg: { flex: 1, height: 6, backgroundColor: Theme.colors.border, borderRadius: 3, overflow: 'hidden' },
  breakdownBar: { height: '100%', backgroundColor: '#FDCB6E' },
  breakdownCount: { width: 30, fontSize: 12, textAlign: 'right', color: Theme.colors.textSecondary },

  reviewCard: { backgroundColor: Theme.colors.surfaceSecondary, borderRadius: Theme.radius.lg, padding: Theme.spacing.md, marginBottom: Theme.spacing.sm },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reviewUser: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm },
  reviewAvatarFallback: { width: 38, height: 38, borderRadius: 19, backgroundColor: Theme.colors.primary, justifyContent: 'center', alignItems: 'center' },
  reviewAvatarInitial: { color: Theme.colors.white, fontSize: Theme.font.md, fontWeight: '700' },
  reviewName: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.text },
  reviewDate: { fontSize: 11, color: Theme.colors.textMuted },
  reviewComment: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, lineHeight: 20 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  verifiedText: { fontSize: 11, color: Theme.colors.success, fontWeight: '600' },
  viewAllReviews: { marginTop: 8, alignItems: 'center' },
  viewAllReviewsText: { color: Theme.colors.primary, fontWeight: '600' },

  // Review form
  reviewForm: { backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg, padding: Theme.spacing.lg, borderWidth: 1, borderColor: Theme.colors.borderLight },
  reviewFormLabel: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.text, marginBottom: 8 },
  starSelector: { flexDirection: 'row', gap: 8, marginBottom: Theme.spacing.lg },
  reviewInput: { borderWidth: 1.5, borderColor: Theme.colors.border, borderRadius: Theme.radius.md, padding: Theme.spacing.md, fontSize: Theme.font.sm, color: Theme.colors.text, minHeight: 100, marginBottom: Theme.spacing.md },
  submitReviewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.md, height: 48, marginBottom: 8 },
  submitReviewBtnDisabled: { opacity: 0.5 },
  submitReviewText: { color: Theme.colors.white, fontWeight: '700', fontSize: Theme.font.md },
  reviewDisclaimer: { fontSize: 11, color: Theme.colors.textMuted, textAlign: 'center' },
  reviewSuccessCard: { backgroundColor: Theme.colors.successSurface, borderRadius: Theme.radius.lg, padding: Theme.spacing.xl, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Theme.colors.success + '30' },
  reviewSuccessTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.success },
  reviewSuccessText: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  bottomBar: { flexDirection: 'row', gap: Theme.spacing.md, padding: Theme.spacing.lg, backgroundColor: Theme.colors.surface, borderTopWidth: 1, borderTopColor: Theme.colors.borderLight, ...Theme.shadow.md },
  addToCartBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.md, height: 52 },
  addToCartText: { color: Theme.colors.white, fontSize: Theme.font.md, fontWeight: '700' },
  buyNowBtn: { flex: 1, backgroundColor: Theme.colors.danger, borderRadius: Theme.radius.md, height: 52, justifyContent: 'center', alignItems: 'center' },
  buyNowText: { color: Theme.colors.white, fontSize: Theme.font.md, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Theme.colors.surface, borderTopLeftRadius: Theme.radius.xl, borderTopRightRadius: Theme.radius.xl, padding: Theme.spacing.xxl, alignItems: 'center', gap: Theme.spacing.md },
  modalIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Theme.colors.warningSurface, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: Theme.font.xl, fontWeight: '800', color: Theme.colors.text },
  modalSub: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, textAlign: 'center' },
  modalCallBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.md, paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.xxl, width: '100%', justifyContent: 'center' },
  modalCallText: { color: Theme.colors.white, fontWeight: '700', fontSize: Theme.font.md },
  modalDismiss: { paddingVertical: Theme.spacing.sm },
  modalDismissText: { color: Theme.colors.textSecondary, fontSize: Theme.font.sm },
});