import { create } from 'zustand';
import { api } from '../services/api';

interface WishlistItem {
  _id: string;
  productId: string;
  name: string;
  price: number;
  image: string;
}

interface WishlistStore {
  items: WishlistItem[];
  loading: boolean;
  fetchWishlist: () => Promise<void>;
  addItem: (productId: string) => Promise<boolean>;
  removeItem: (productId: string) => Promise<boolean>;
  isInWishlist: (productId: string) => boolean;
}

export const useWishlistStore = create<WishlistStore>((set, get) => ({
  items: [],
  loading: false,

  fetchWishlist: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/api/wishlist');
      set({ items: res.data });
    } catch (error) {
      console.error('Fetch wishlist failed', error);
    } finally {
      set({ loading: false });
    }
  },

  addItem: async (productId) => {
    try {
      await api.post('/api/wishlist', { productId });
      await get().fetchWishlist();
      return true;
    } catch {
      return false;
    }
  },

  removeItem: async (productId) => {
    try {
      await api.delete(`/api/wishlist/${productId}`);
      await get().fetchWishlist();
      return true;
    } catch {
      return false;
    }
  },

  isInWishlist: (productId) => {
    return get().items.some(item => item.productId === productId);
  },
}));