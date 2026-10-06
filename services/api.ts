// services/api.ts
/**
 * @deprecated Use `apiClient` from ./api-client (typed, contract-checked).
 *
 * `api` is the same authenticated axios instance (Bearer token + one refresh
 * and one retry on 401), kept under its old name for screens that still call
 * `api.get(...)` / `api.post(...)` directly.
 */
export { http as api } from './api-client';
