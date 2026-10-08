// A fake backend for tests. Requests made through axios (see
// install-fake-network.ts) are recorded and answered by the handler a test
// installs with `network.handle(...)`.
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';

/** One request the app made. */
export interface RecordedCall {
  method: string;
  url: string;
  /** The Authorization header, if any. */
  auth?: string;
  headers: AxiosHeaders;
  /** The JSON body, parsed. */
  data: any;
}

export interface FakeResponse {
  status: number;
  data?: unknown;
  headers?: Record<string, string>;
}

/** Return this from a handler to simulate "no response at all" (offline, timeout). */
export class NetworkFailure {
  constructor(
    readonly code: string = 'ERR_NETWORK',
    readonly message: string = 'Network Error'
  ) {}
}

type HandlerResult = FakeResponse | NetworkFailure;
export type Handler = (call: RecordedCall) => HandlerResult | Promise<HandlerResult>;

let handler: Handler | null = null;

export const network = {
  /** Every request since the last `clear()`, in order. */
  calls: [] as RecordedCall[],

  handle(next: Handler) {
    handler = next;
  },
  clear() {
    this.calls = [];
  },
  /** How many requests were made to `url` (optionally for one HTTP method). */
  count(url: string, method?: string): number {
    return this.calls.filter((c) => c.url === url && (!method || c.method === method)).length;
  },
  find(url: string, method?: string): RecordedCall | undefined {
    return this.calls.find((c) => c.url === url && (!method || c.method === method));
  },
};

export const json = (status: number, data?: unknown, headers?: Record<string, string>): FakeResponse => ({
  status,
  data,
  headers,
});

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

(globalThis as { __fakeNetwork?: unknown }).__fakeNetwork = async (config: InternalAxiosRequestConfig) => {
  const headers = AxiosHeaders.from(config.headers);
  const call: RecordedCall = {
    method: String(config.method).toUpperCase(),
    url: String(config.url),
    auth: (headers.get('Authorization') as string | undefined) ?? undefined,
    headers,
    data: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
  };
  network.calls.push(call);
  await sleep(2); // real requests are never instantaneous

  if (!handler) throw new Error(`No fake handler installed for ${call.method} ${call.url}`);
  const result = await handler(call);

  if (result instanceof NetworkFailure) {
    throw new AxiosError(result.message, result.code, config, {});
  }
  const response = {
    data: result.data,
    status: result.status,
    statusText: String(result.status),
    headers: result.headers ?? {},
    config,
    request: {},
  };
  if (result.status >= 200 && result.status < 300) return response;
  throw new AxiosError(`Request failed with status code ${result.status}`, 'ERR_BAD_REQUEST', config, {}, response);
};

/** A login/refresh response body with fresh expiry times. */
export function tokenResponse(accessToken: string, refreshToken: string) {
  return {
    success: true as const,
    tokenType: 'Bearer' as const,
    accessToken,
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    refreshToken,
    refreshTokenExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    user: TEST_USER,
  };
}

export const TEST_USER = { id: 'u1', email: 'a@b.co', name: 'Asha', role: 'user' as const, shopId: null };
