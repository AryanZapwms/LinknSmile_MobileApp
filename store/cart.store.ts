// store/cart.store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { storage } from '../utils/storage';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  discountPrice?: number;
  quantity: number;
  image: string;
  stock: number;
  shopId?: string;
  shopName?: string;
  vendorId?: string;
  vendorName?: string;
  selectedSize?: {
    size: string;
    quantity: number;
    unit: string;
  };
}

interface CartState {
  items: CartItem[];
  isLoading: boolean;
  error: string | null;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, sizeKey?: string) => void;
  updateQuantity: (productId: string, quantity: number, sizeKey?: string) => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  clearCart: () => void;
  syncCart: () => Promise<void>;
  loadCart: () => Promise<void>;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      error: null,

      // ✅ Hydration state — prevents addItem from firing before AsyncStorage loads
      _hasHydrated: false,
      setHasHydrated: (hasHydrated: boolean) => {
        console.log('💧 Cart store hydration state:', hasHydrated);
        set({ _hasHydrated: hasHydrated });
      },

      addItem: (item: CartItem) => {
        console.log('🛒 addItem called with:', item);

        const { items } = get();
        const currentTotalItems = get().getTotalItems();

        console.log('📊 Current cart state:', {
          existingItems: items.length,
          currentTotalItems,
          items: items.map(i => ({ name: i.name, quantity: i.quantity })),
        });

        if (currentTotalItems >= 5) {
          console.log('⚠️ Bulk order limit reached (5 items max)');
          return;
        }

        const sizeKey = item.selectedSize
          ? `${item.selectedSize.size}-${item.selectedSize.quantity}`
          : undefined;

        const existingItemIndex = items.findIndex(
          (i) =>
            i.productId === item.productId &&
            (sizeKey
              ? i.selectedSize?.size === item.selectedSize?.size
              : !i.selectedSize)
        );

        console.log('🔍 Existing item check:', { existingItemIndex, sizeKey });

        let updatedItems: CartItem[];

        if (existingItemIndex !== -1) {
          console.log('📦 Updating existing item quantity');
          updatedItems = [...items];
          const newQuantity = Math.min(
            updatedItems[existingItemIndex].quantity + item.quantity,
            updatedItems[existingItemIndex].stock
          );
          updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            quantity: newQuantity,
          };
          console.log('✅ Item updated, new quantity:', newQuantity);
        } else {
          console.log('🆕 Adding new item to cart');
          updatedItems = [...items, item];
          console.log('✅ New item added');
        }

        set({ items: updatedItems });

        console.log('📦 Cart after update:', {
          totalItems: updatedItems.length,
          items: updatedItems.map(i => ({ name: i.name, quantity: i.quantity })),
        });

        get().syncCart();
      },

      removeItem: (productId: string, sizeKey?: string) => {
        console.log('🗑️ removeItem called:', { productId, sizeKey });

        const { items } = get();
        const updatedItems = items.filter(
          (item) =>
            !(
              item.productId === productId &&
              (sizeKey
                ? item.selectedSize?.size === sizeKey
                : !item.selectedSize)
            )
        );
        set({ items: updatedItems });
        console.log('✅ Item removed, remaining:', updatedItems.length);

        get().syncCart();
      },

      updateQuantity: (productId: string, quantity: number, sizeKey?: string) => {
        console.log('🔄 updateQuantity called:', { productId, quantity, sizeKey });

        const { items } = get();
        const updatedItems = items.map((item) => {
          if (
            item.productId === productId &&
            (sizeKey
              ? item.selectedSize?.size === sizeKey
              : !item.selectedSize)
          ) {
            const newQuantity = Math.min(Math.max(1, quantity), item.stock);
            console.log(
              `📦 Updating quantity for ${item.name}: ${item.quantity} -> ${newQuantity}`
            );
            return { ...item, quantity: newQuantity };
          }
          return item;
        });
        set({ items: updatedItems });

        get().syncCart();
      },

      getTotalItems: () => {
        const { items } = get();
        const total = items.reduce((sum, item) => sum + item.quantity, 0);
        console.log('📊 getTotalItems:', total);
        return total;
      },

      getTotalPrice: () => {
        const { items } = get();
        const total = items.reduce((sum, item) => {
          const price = item.discountPrice || item.price;
          return sum + price * item.quantity;
        }, 0);
        console.log('💰 getTotalPrice:', total);
        return total;
      },

      clearCart: () => {
        console.log('🧹 clearCart called');
        set({ items: [] });
        get().syncCart();
      },

      syncCart: async () => {
        const { items } = get();
        console.log('🔄 syncCart called, items count:', items.length);

        const token = await storage.getToken();
        console.log('🔑 Token exists:', !!token);

        if (!token) {
          console.log('⚠️ No token found, skipping server sync');
          return;
        }

        set({ isLoading: true, error: null });

        try {
          const cartData = {
            items: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              selectedSize: item.selectedSize,
            })),
          };

          console.log('📤 Sending cart to server:', cartData);
          await api.post('/api/cart', cartData);
          console.log('✅ Cart synced with server successfully');
          set({ isLoading: false });
        } catch (error: any) {
          console.error('❌ Error syncing cart:', error.message);
          // Don't clear cart on 401 — api.ts interceptor handles token cleanup
          set({ error: error.message, isLoading: false });
        }
      },

      loadCart: async () => {
        console.log('📥 loadCart called');

        const token = await storage.getToken();
        console.log('🔑 Token exists:', !!token);

        if (!token) {
          console.log('⚠️ No token found, skipping load from server');
          return;
        }

        set({ isLoading: true, error: null });

        try {
          const response = await api.get('/api/cart');
          console.log('📦 Server cart response:', response.data);

          const serverItems = response.data.items || [];

          if (serverItems.length > 0) {
            const mappedItems: CartItem[] = serverItems.map((item: any) => ({
              productId: item.productId,
              name: item.name,
              price: item.price,
              discountPrice: item.discountPrice,
              quantity: item.quantity,
              image: item.image,
              stock: item.stock,
              shopId: item.shopId,
              shopName: item.shopName,
              vendorId: item.vendorId,
              vendorName: item.vendorName,
              selectedSize: item.selectedSize,
            }));
            console.log('✅ Loaded items from server:', mappedItems.length);
            set({ items: mappedItems, isLoading: false });
          } else {
            console.log('📭 No items found on server, keeping local cart');
            set({ isLoading: false });
          }
        } catch (error: any) {
          console.error('❌ Error loading cart from server:', error.message);
          // ✅ Don't wipe local cart on any error — just stop loading
          // Token cleanup on 401 is handled by the api.ts interceptor
          set({ error: error.message, isLoading: false });
        }
      },
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // ✅ Notify store when AsyncStorage has finished rehydrating
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true);
          console.log('✅ Cart store rehydrated from AsyncStorage');
        }
      },
    }
  )
);