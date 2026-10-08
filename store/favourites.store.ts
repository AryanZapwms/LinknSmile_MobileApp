// store/favourites.store.ts
// The signed-in user's favourites (GET/POST /api/favourites), the same list
// the website shows. The server stores references only ({ type, refId });
// screens fetch product details separately via /api/products?ids=…
import { create } from 'zustand';
import { apiClient } from '../services/api-client';

interface FavouritesState {
  /** Ids of favourited products. */
  productIds: string[];
  /** Ids of favourited sellers (shown on the website; listed here for completeness). */
  sellerIds: string[];
  loaded: boolean;
  loading: boolean;
  load: () => Promise<void>;
  /** Adds or removes a product. Resolves to true if it is now a favourite. */
  toggleProduct: (productId: string) => Promise<boolean>;
  /** Forgets everything (sign-out). */
  reset: () => void;
}

export const useFavouritesStore = create<FavouritesState>((set, get) => ({
  productIds: [],
  sellerIds: [],
  loaded: false,
  loading: false,

  load: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const favourites = await apiClient.favourites.list();
      set({
        productIds: favourites.filter((f) => f.type === 'product').map((f) => f.refId),
        sellerIds: favourites.filter((f) => f.type === 'seller').map((f) => f.refId),
        loaded: true,
      });
    } finally {
      set({ loading: false });
    }
  },

  toggleProduct: async (productId) => {
    const before = get().productIds;
    const wasFavourite = before.includes(productId);
    // Show the change immediately; put it back if the server says no.
    set({ productIds: wasFavourite ? before.filter((id) => id !== productId) : [...before, productId] });
    try {
      const { added } = await apiClient.favourites.toggle({ type: 'product', refId: productId });
      const current = get().productIds.filter((id) => id !== productId);
      set({ productIds: added ? [...current, productId] : current });
      return added;
    } catch (error) {
      set({ productIds: before });
      throw error;
    }
  },

  reset: () => set({ productIds: [], sellerIds: [], loaded: false, loading: false }),
}));
