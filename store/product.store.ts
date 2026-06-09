// store/product.store.ts
import { create } from 'zustand';
import { api } from '../services/api';

export interface Product {
  _id: string;
  id?: string;
  name: string;
  description: string;
  price: number;
  discountPrice?: number;
  image?: string;
  images: string[];
  category: {
    _id: string;
    name: string;
  } | null;
  shopId?: {
    _id: string;
    shopName: string;
  };
  vendor?: {
    _id?: string;
    name: string;
  };
  rating?: number;
  stock: number;
  slug: string;
  createdAt: string;
}

export interface Category {
  _id: string;
  id?: string;
  name: string;
  image?: string;
  slug?: string;
  productCount?: number;
  isActive?: boolean;
}

interface ProductState {
  products: Product[];
  featuredProducts: Product[];
  categories: Category[];
  isLoading: boolean;
  isCategoriesLoading: boolean;
  error: string | null;
  fetchProducts: (params?: any) => Promise<void>;
  fetchFeaturedProducts: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  searchProducts: (query: string) => Promise<void>;
  fetchProductById: (id: string) => Promise<Product | null>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  featuredProducts: [],
  categories: [],
  isLoading: false,
  isCategoriesLoading: false,
  error: null,

  fetchProducts: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/api/products', { params: { limit: 1000, ...params } });
      const fetchedProducts = (response.data.products || []).map((p: any) => ({
        ...p,
        id: p._id,
        images: p.images?.length ? p.images : [p.image || 'https://via.placeholder.com/150'],
        vendor: p.vendor ?? p.shopId ?? { name: 'Unknown' },
      }));
      set({ products: fetchedProducts, isLoading: false });
    } catch (error: any) {
      console.error('fetchProducts error:', error.message);
      set({ isLoading: false, error: error.message || 'Failed to fetch products' });
    }
  },

  fetchFeaturedProducts: async () => {
    try {
      const response = await api.get('/api/products', { params: { limit: 10, featured: true } });
      const products = (response.data.products || []).map((p: any) => ({
        ...p,
        id: p._id,
        images: p.images?.length ? p.images : [p.image || 'https://via.placeholder.com/150'],
      }));
      set({ featuredProducts: products });
    } catch (error: any) {
      console.error('fetchFeaturedProducts error:', error.message);
      try {
        const fallbackResponse = await api.get('/api/products', { params: { limit: 10 } });
        const products = (fallbackResponse.data.products || []).map((p: any) => ({
          ...p,
          id: p._id,
          images: p.images?.length ? p.images : [p.image || 'https://via.placeholder.com/150'],
        }));
        set({ featuredProducts: products });
      } catch (fallbackError) {
        console.error('Featured products fallback failed:', fallbackError);
        set({ featuredProducts: [] });
      }
    }
  },

  fetchCategories: async () => {
    set({ isCategoriesLoading: true, error: null });
    try {
      const response = await api.get('/api/categories', { params: { isActive: true, limit: 100 } });
      let categoriesData: any[] = [];
      if (Array.isArray(response.data)) categoriesData = response.data;
      else if (response.data.categories) categoriesData = response.data.categories;
      else if (response.data.data) categoriesData = response.data.data;

      const formattedCategories = categoriesData.map((cat: any) => ({
        _id: cat._id || cat.id,
        id: cat._id || cat.id,
        name: cat.name,
        image: cat.image || cat.icon || 'https://via.placeholder.com/150',
        slug: cat.slug,
        productCount: cat.productCount || cat.count || 0,
        isActive: cat.isActive !== false,
      }));

      set({ categories: formattedCategories, isCategoriesLoading: false });
    } catch (error: any) {
      console.error('fetchCategories error:', error.message);
      try {
        const productsResponse = await api.get('/api/products', { params: { limit: 1000 } });
        const products = productsResponse.data.products || [];
        const categoryMap = new Map<string, Category>();
        products.forEach((product: any) => {
          if (product.category?._id && product.category?.name) {
            if (!categoryMap.has(product.category._id)) {
              categoryMap.set(product.category._id, {
                _id: product.category._id,
                id: product.category._id,
                name: product.category.name,
                image: product.category.image || 'https://via.placeholder.com/150',
                productCount: 1,
              });
            } else {
              const existing = categoryMap.get(product.category._id)!;
              existing.productCount = (existing.productCount || 0) + 1;
            }
          }
        });
        set({ categories: Array.from(categoryMap.values()), isCategoriesLoading: false });
      } catch (fallbackError) {
        console.error('Fallback categories fetch also failed:', fallbackError);
        set({ categories: [], isCategoriesLoading: false, error: 'Failed to load categories' });
      }
    }
  },

  searchProducts: async (query: string) => {
    set({ isLoading: true });
    try {
      const response = await api.get('/api/products', { params: { search: query, limit: 1000 } });
      const fetchedProducts = (response.data.products || []).map((p: any) => ({ ...p, id: p._id }));
      set({ products: fetchedProducts, isLoading: false });
    } catch (error: any) {
      console.error('searchProducts error:', error.message);
      set({ isLoading: false, error: error.message });
    }
  },

  fetchProductById: async (id: string) => {
    try {
      const response = await api.get(`/api/products/${id}`);
      return response.data;
    } catch {
      return null;
    }
  },
}));