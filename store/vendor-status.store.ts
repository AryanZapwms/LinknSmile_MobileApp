// store/vendor-status.store.ts
// The signed-in seller's status (GET /api/vendor/status): agreement accepted,
// subscription, shop approval. app/(vendor)/_layout.tsx and the selling
// screens decide what to show from it; see services/vendor-access.ts.
import { create } from 'zustand';
import { apiClient, setVendorBlockListener } from '../services/api-client';
import { toApiError, type ApiError } from '../services/api-error';
import type { VendorStatus } from '../services/vendor-access';

interface VendorStatusState {
  /** The last status the server reported; null until the first successful load. */
  status: VendorStatus | null;
  loading: boolean;
  /** Why the latest load failed. A status loaded earlier is kept. */
  error: ApiError | null;
  /** Asks the server again. Calls made while one is running share its request. */
  load: () => Promise<void>;
  /** Forgets everything (sign-out). */
  reset: () => void;
}

let inFlight: Promise<void> | null = null;
// Bumped by reset(), so a request that was already in the air at sign-out
// can't write one seller's status into the next seller's session.
let generation = 0;

export const useVendorStatusStore = create<VendorStatusState>((set) => ({
  status: null,
  loading: false,
  error: null,

  load: () => {
    if (inFlight) return inFlight;
    const startedIn = generation;
    set({ loading: true });
    const request: Promise<void> = apiClient.vendor
      .status()
      .then(
        (status) => {
          if (startedIn === generation) set({ status, error: null, loading: false });
        },
        (error) => {
          if (startedIn === generation) set({ error: toApiError(error), loading: false });
        }
      )
      .finally(() => {
        if (inFlight === request) inFlight = null;
      });
    inFlight = request;
    return request;
  },

  reset: () => {
    generation++;
    inFlight = null;
    set({ status: null, loading: false, error: null });
  },
}));

// The server refused a seller request with one of the gate codes, so the
// status held here is stale (for example the agreement got a new version, or
// the subscription ran out while the app was open). Ask again; the screens
// follow the store.
setVendorBlockListener(() => {
  void useVendorStatusStore.getState().load();
});
