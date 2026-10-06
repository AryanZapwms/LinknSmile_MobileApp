// store/auth.store.ts
import { create } from 'zustand';
import type { AuthUserDto } from '../contracts';
import { ApiError, toApiError } from '../services/api-error';
import { apiClient, clearLocalSession, setSessionListener } from '../services/api-client';
import { setMonitoringUser } from '../services/monitoring';
import { registerForPushNotifications } from '../services/notification.service';
import { isExpired, tokenStore } from '../services/token-store';
import { useCartStore } from './cart.store';
import { useFavouritesStore } from './favourites.store';

/** Server roles: "user" (customer), "shop_owner" (vendor), "admin". */
export type UserRole = AuthUserDto['role'];

/** The signed-in user. `phone` and `image` are filled in by the profile screens. */
export interface User extends AuthUserDto {
  phone?: string | null;
  image?: string | null;
}

export type LoginResult = { ok: true } | { ok: false; error: ApiError };

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  /** False until the stored session has been read at app start. */
  sessionRestored: boolean;
  /** Merges profile changes into the signed-in user (and the stored session). */
  setUser: (user: Partial<User> | null) => void;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  /** Signs out locally after the account was deleted on the server. */
  signOutAfterAccountDeletion: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

/** Things to do once we know who is signed in. None of them may block the UI. */
function afterSignIn(userId: string) {
  setMonitoringUser(userId);
  void useCartStore.getState().loadCart();
  void useFavouritesStore.getState().load().catch(() => {});
  void registerForPushNotifications();
}

/** Clears everything that belongs to the signed-in user from memory. */
function resetUserData() {
  setMonitoringUser(null);
  useCartStore.getState().resetLocal();
  useFavouritesStore.getState().reset();
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  sessionRestored: false,

  setUser: (changes) => {
    if (!changes) {
      set({ user: null });
      return;
    }
    const current = get().user;
    if (!current) return;
    // Identity fields (id, role, shopId) only ever come from the server's tokens.
    const { name, email, phone, image } = changes;
    const user: User = {
      ...current,
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(image !== undefined && { image }),
    };
    set({ user });
    void tokenStore.load().then((session) => {
      if (session) return tokenStore.save({ ...session, user: { ...session.user, name: user.name, email: user.email } });
    });
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const session = await apiClient.auth.login({ email, password });
      set({ user: session.user, isLoading: false, sessionRestored: true });
      afterSignIn(session.user.id);
      return { ok: true };
    } catch (error) {
      set({ isLoading: false, sessionRestored: true });
      return { ok: false, error: toApiError(error, 'Login failed. Please try again.') };
    }
  },

  logout: async () => {
    set({ isLoading: true });
    await apiClient.auth.logout(); // never throws; local sign-out always succeeds
    resetUserData();
    set({ user: null, isLoading: false, sessionRestored: true });
  },

  signOutAfterAccountDeletion: async () => {
    await clearLocalSession();
    resetUserData();
    set({ user: null, isLoading: false, sessionRestored: true });
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const session = await tokenStore.load();
      // Past the refresh token's lifetime nothing can be refreshed: sign in again.
      if (!session || isExpired(session.refreshTokenExpiresAt)) {
        if (session) await tokenStore.clear();
        set({ user: null, isLoading: false, sessionRestored: true });
        return;
      }
      set({ user: session.user, isLoading: false, sessionRestored: true });
      afterSignIn(session.user.id);
    } catch {
      set({ user: null, isLoading: false, sessionRestored: true });
    }
  },
}));

// The API client tells us when tokens were refreshed (the user's role or shop
// may have changed) and when the server ended the session.
setSessionListener({
  onSessionUpdated: (session) => {
    const current = useAuthStore.getState().user;
    if (current) useAuthStore.setState({ user: { ...current, ...session.user } });
  },
  onSessionEnded: () => {
    resetUserData();
    // app/_layout.tsx sends the user to the login screen when `user` becomes null.
    useAuthStore.setState({ user: null, isLoading: false, sessionRestored: true });
  },
});
