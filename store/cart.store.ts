// store/cart.store.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { apiClient } from '../services/api-client';
import { tokenStore } from '../services/token-store';

export interface CartItem {
  productId: string;
  name: string;
  slug?: string;
  /** Unit price before discount (the size's price when a size is selected). */
  price: number;
  /** Discounted unit price, if any. */
  discountPrice?: number | null;
  quantity: number;
  image: string;
  stock: number;
  shopId?: string;
  shopName?: string;
  /**
   * The chosen size variant. `size` + `quantity` identify it on the server
   * (e.g. size "Small", quantity 50, unit "ml").
   */
  selectedSize?: {
    size: string;
    quantity: number;
    unit?: string;
  } | null;
}

/** Most units the app lets a customer put in one cart; larger orders go through support. */
export const MAX_CART_UNITS = 5;

/** Identifies a cart line: the product plus its size variant, if any. */
export function cartItemKey(item: Pick<CartItem, 'productId' | 'selectedSize'>): string {
  return `${item.productId}|${item.selectedSize?.size ?? ''}|${item.selectedSize?.quantity ?? ''}`;
}

/** What one unit of this line costs. */
export function unitPrice(item: Pick<CartItem, 'price' | 'discountPrice'>): number {
  return item.discountPrice || item.price;
}

interface CartState {
  items: CartItem[];
  isLoading: boolean;
  error: string | null;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  /** Adds a line, or increases its quantity if the same product + size is already there. */
  addItem: (item: CartItem) => void;
  removeItem: (key: string) => void;
  /** Removes several lines at once (e.g. the ones that were just ordered). */
  removeItems: (keys: string[]) => void;
  updateQuantity: (key: string, quantity: number) => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  /** Empties the cart here and on the server. */
  clearCart: () => void;
  /** Empties the cart in memory only (sign-out); the server copy is untouched. */
  resetLocal: () => void;
  syncCart: () => Promise<void>;
  loadCart: () => Promise<void>;
}

// Server syncs replace the whole cart, so they must not overlap or arrive out
// of order: run one at a time and, if changes came in meanwhile, send the
// latest state once more.
let syncing = false;
let syncAgain = false;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      error: null,

      // Set once AsyncStorage has been read, so nothing writes before that.
      _hasHydrated: false,
      setHasHydrated: (hasHydrated) => set({ _hasHydrated: hasHydrated }),

      addItem: (item) => {
        const { items } = get();
        if (get().getTotalItems() >= MAX_CART_UNITS) return;

        const key = cartItemKey(item);
        const existing = items.find((i) => cartItemKey(i) === key);
        const updated = existing
          ? items.map((i) =>
              i === existing ? { ...i, quantity: Math.min(i.quantity + item.quantity, i.stock) } : i
            )
          : [...items, item];

        set({ items: updated });
        void get().syncCart();
      },

      removeItem: (key) => get().removeItems([key]),

      removeItems: (keys) => {
        const remove = new Set(keys);
        set({ items: get().items.filter((item) => !remove.has(cartItemKey(item))) });
        void get().syncCart();
      },

      updateQuantity: (key, quantity) => {
        set({
          items: get().items.map((item) =>
            cartItemKey(item) === key
              ? { ...item, quantity: Math.min(Math.max(1, quantity), item.stock) }
              : item
          ),
        });
        void get().syncCart();
      },

      getTotalItems: () => get().items.reduce((sum, item) => sum + item.quantity, 0),

      getTotalPrice: () => get().items.reduce((sum, item) => sum + unitPrice(item) * item.quantity, 0),

      clearCart: () => {
        set({ items: [] });
        void get().syncCart();
      },

      resetLocal: () => set({ items: [], error: null, isLoading: false }),

      syncCart: async () => {
        if (!(await tokenStore.load())) return; // not signed in: the cart stays local
        if (syncing) {
          syncAgain = true;
          return;
        }
        syncing = true;
        try {
          do {
            syncAgain = false;
            await apiClient.cart.replace({
              items: get().items.map((item) => ({
                productId: item.productId,
                name: item.name,
                slug: item.slug ?? item.productId,
                image: item.image,
                quantity: item.quantity,
                selectedSize: item.selectedSize
                  ? { size: item.selectedSize.size, quantity: item.selectedSize.quantity }
                  : undefined,
              })),
            });
          } while (syncAgain);
          set({ error: null });
        } catch (error) {
          // The local cart is the one the user sees; a failed sync is retried
          // on the next change.
          set({ error: error instanceof Error ? error.message : 'Cart sync failed' });
        } finally {
          syncing = false;
        }
      },

      loadCart: async () => {
        if (!(await tokenStore.load())) return;
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.cart.get();
          const serverItems = (response.items ?? []) as Record<string, any>[];

          // An empty server cart never wipes the local one.
          if (serverItems.length > 0) {
            const items: CartItem[] = serverItems
              .filter((item) => item?.productId)
              .map((item) => ({
                productId: String(item.productId),
                name: item.name ?? 'Product',
                slug: item.slug,
                price: Number(item.price) || 0,
                discountPrice: item.discountPrice ?? null,
                quantity: Number(item.quantity) || 1,
                image: item.image ?? '',
                stock: Number(item.stock) || 0,
                shopId: item.shopId ? String(item.shopId) : undefined,
                shopName: item.shopName,
                selectedSize: item.selectedSize?.size
                  ? {
                      size: item.selectedSize.size,
                      quantity: Number(item.selectedSize.quantity),
                      unit: item.selectedSize.unit,
                    }
                  : null,
              }));
            set({ items });
          }
          set({ isLoading: false });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Could not load the cart', isLoading: false });
        }
      },
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only the items are worth keeping between launches.
      partialize: (state) => ({ items: state.items }),
      // v2: `selectedSize` is an object (or null). Earlier builds could store
      // a bare string there, which the server cannot price.
      version: 2,
      migrate: (persisted) => {
        const items = ((persisted as { items?: CartItem[] } | undefined)?.items ?? []).map((item) => ({
          ...item,
          selectedSize: item.selectedSize && typeof item.selectedSize === 'object' ? item.selectedSize : null,
        }));
        return { items };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
