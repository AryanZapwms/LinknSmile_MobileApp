// app/(vendor)/products/edit/[id].tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Image, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '../../../../services/api';
import { Theme } from '../../../../constants/theme';
import { withSellingGate } from '../../../../components/vendor/SellingGate';

interface Category {
  _id: string;
  name: string;
}

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  discountPrice?: number;
  stock: number;
  images: string[];
  category?: string;
}

function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [stock, setStock] = useState('');
  const [category, setCategory] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchProduct();
    fetchCategories();
  }, []);

  const fetchProduct = async () => {
    try {
      const res = await api.get(`/api/vendor/products/${id}`);
      const product = res.data.product;
      setName(product.name || '');
      setDescription(product.description || '');
      setPrice(product.price?.toString() || '');
      setDiscountPrice(product.discountPrice?.toString() || '');
      setStock(product.stock?.toString() || '');
      setCategory(product.category?._id || '');
      setImages(product.images || []);
    } catch (error) {
      console.error('Error fetching product:', error);
      Alert.alert('Error', 'Failed to load product');
      router.back();
    } finally {
      setLoading(false);
    }
  };

 const fetchCategories = async () => {
  try {
    console.log('[AddProduct] Fetching categories...');
    const res = await api.get('/api/categories');
    console.log('[AddProduct] Categories response:', JSON.stringify(res.data, null, 2));
    const data = res.data;

    let categoriesArray: Category[] = [];
    if (data.categories && Array.isArray(data.categories)) {
      categoriesArray = data.categories;
    } else if (data.data && Array.isArray(data.data)) {
      categoriesArray = data.data;
    } else if (Array.isArray(data)) {
      categoriesArray = data;
    } else if (data && typeof data === 'object') {
      // Try to find any array property
      const possibleArray = Object.values(data).find(val => Array.isArray(val));
      if (possibleArray) categoriesArray = possibleArray;
    }

    if (categoriesArray.length > 0) {
      setCategories(categoriesArray);
      if (!category) setCategory(categoriesArray[0]._id);
    } else {
      console.warn('[AddProduct] No categories found in response');
      // Optionally, set a dummy category or allow product creation without category
    }
  } catch (error) {
    console.error('Error fetching categories:', error);
    Alert.alert('Error', 'Could not load categories. Please check your connection.');
  }
};

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      await uploadImage(uri);
    }
  };

  const uploadImage = async (uri: string) => {
    const formData = new FormData();
    const filename = uri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename || '');
    const type = match ? `image/${match[1]}` : 'image';

    formData.append('file', {
      uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
      name: filename,
      type,
    } as any);

    try {
      const res = await api.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.url) {
        setImages((prev) => [...prev, res.data.url]);
      } else {
        Alert.alert('Upload failed', 'Could not upload image');
      }
    } catch (error) {
      console.error('Image upload error:', error);
      Alert.alert('Error', 'Failed to upload image');
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    if (!name.trim()) { Alert.alert('Error', 'Product name is required'); return false; }
    if (!price.trim()) { Alert.alert('Error', 'Price is required'); return false; }
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) { Alert.alert('Error', 'Price must be a positive number'); return false; }
    if (discountPrice) {
      const numDiscount = parseFloat(discountPrice);
      if (isNaN(numDiscount) || numDiscount < 0) { Alert.alert('Error', 'Invalid discount price'); return false; }
      if (numDiscount >= numPrice) { Alert.alert('Error', 'Discount price must be less than original price'); return false; }
    }
    if (!stock.trim()) { Alert.alert('Error', 'Stock is required'); return false; }
    const numStock = parseInt(stock, 10);
    if (isNaN(numStock) || numStock < 0) { Alert.alert('Error', 'Stock must be a non-negative number'); return false; }
    if (images.length === 0) { Alert.alert('Error', 'At least one product image is required'); return false; }
    return true;
  };

const handleUpdate = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      // Generate slug from name (same as add screen)
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const payload = {
        name: name.trim(),
        slug: slug,
        description: description.trim(),
        price: parseFloat(price),
        discountPrice: discountPrice ? parseFloat(discountPrice) : null,
        stock: parseInt(stock, 10),
        category: category,
        images,
      };
      const res = await api.put(`/api/vendor/products/${id}`, payload);
      if (res.status === 200) {
        Alert.alert('Success', 'Product updated successfully!');
        router.back();
      } else {
        Alert.alert('Error', res.data?.message || 'Failed to update product');
      }
    } catch (error: any) {
      console.error('Update product error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Product</Text>
        </View>

        <View style={styles.form}>
          {/* Same form fields as add product, just pre-filled */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Product Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter product name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Product description"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Price (₹) *</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Discount Price (₹)</Text>
              <TextInput
                style={styles.input}
                value={discountPrice}
                onChangeText={setDiscountPrice}
                placeholder="0.00"
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Stock *</Text>
              <TextInput
                style={styles.input}
                value={stock}
                onChangeText={setStock}
                placeholder="Quantity"
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.pickerContainer}>
                <TextInput
                  style={styles.input}
                  value={categories.find(c => c._id === category)?.name || ''}
                  editable={false}
                  placeholder="Select category"
                />
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => {
                    Alert.alert(
                      'Select Category',
                      '',
                      categories.map(cat => ({
                        text: cat.name,
                        onPress: () => setCategory(cat._id),
                      })),
                    );
                  }}
                >
                  <Ionicons name="chevron-down" size={20} color={Theme.colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Product Images *</Text>
            <View style={styles.imageGrid}>
              {images.map((img, index) => (
                <View key={index} style={styles.imagePreview}>
                  <Image source={{ uri: img }} style={styles.imageThumb} />
                  <TouchableOpacity
                    style={styles.removeImage}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={24} color={Theme.colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
                <Ionicons name="camera" size={32} color={Theme.colors.primary} />
                <Text style={styles.addImageText}>Add Image</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitDisabled]}
            onPress={handleUpdate}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={Theme.colors.white} />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color={Theme.colors.white} />
                <Text style={styles.submitText}>Update Product</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Styles identical to AddProductScreen, copy from above.
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.borderLight,
  },
  backButton: { marginRight: Theme.spacing.md },
  headerTitle: { fontSize: Theme.font.xl, fontWeight: '800', color: Theme.colors.text, flex: 1 },
  form: { padding: Theme.spacing.lg },
  inputGroup: { marginBottom: Theme.spacing.lg },
  label: { fontSize: Theme.font.sm, fontWeight: '500', color: Theme.colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 12,
    fontSize: Theme.font.sm,
    color: Theme.colors.text,
    backgroundColor: Theme.colors.background,
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Theme.spacing.lg },
  pickerContainer: { position: 'relative' },
  pickerButton: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.md,
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: Theme.radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  imageThumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeImage: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderStyle: 'dashed',
  },
  addImageText: { fontSize: 12, color: Theme.colors.primary, marginTop: 4 },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.primary,
    paddingVertical: Theme.spacing.lg,
    borderRadius: Theme.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Theme.spacing.lg,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.white },
});

// Orders and products are selling features: locked, as on the server, while
// the subscription is not active or the shop is not approved.
export default withSellingGate(EditProductScreen, 'Edit Product');
