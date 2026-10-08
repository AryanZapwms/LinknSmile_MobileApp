// services/api-error.ts
// One error type for everything the backend (or the network) can throw at us.
//
// New/mobile routes answer `{ error: "<message>", code: "<CODE>" }`; older
// ones answer only `{ error }` or `{ message }`, and /api/auth/register sends
// `error` as an array of zod issues. ApiError normalises all of these: switch
// on `code` (may be undefined for older routes), show `message`.

import { isAxiosError } from 'axios';
import type { ErrorCode } from '../contracts';

export class ApiError extends Error {
  /** HTTP status, or 0 when the request never got a response. */
  readonly status: number;
  /** Machine-readable code from lib/contracts/errors.ts; undefined on older routes. */
  readonly code?: ErrorCode;
  /** The raw response body, for extra fields such as `openOrders`. */
  readonly data?: Record<string, unknown>;
  /** Seconds to wait before retrying, from the Retry-After header (429s). */
  readonly retryAfterSeconds?: number;
  /** True when there was no response at all (offline, timeout, DNS…). */
  readonly isNetworkError: boolean;

  constructor(init: {
    message: string;
    status?: number;
    code?: ErrorCode;
    data?: Record<string, unknown>;
    retryAfterSeconds?: number;
    isNetworkError?: boolean;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status ?? 0;
    this.code = init.code;
    this.data = init.data;
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.isNetworkError = init.isNetworkError ?? false;
  }
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';
const NETWORK_MESSAGE = "Can't reach the server. Check your internet connection and try again.";

/** Pulls a readable message out of any of the body shapes the backend uses. */
function messageFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const { error, message } = body as { error?: unknown; message?: unknown };
  if (typeof error === 'string' && error) return error;
  if (Array.isArray(error)) {
    // zod issues: [{ message, path }]
    const first = error.find((issue) => typeof issue?.message === 'string');
    if (first) return first.message as string;
  }
  if (typeof message === 'string' && message) return message;
  return undefined;
}

function parseRetryAfter(value: unknown): number | undefined {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined;
}

/** Converts anything thrown by a request into an ApiError. */
export function toApiError(error: unknown, fallbackMessage = GENERIC_MESSAGE): ApiError {
  if (error instanceof ApiError) return error;

  if (isAxiosError(error)) {
    const response = error.response;
    if (!response) {
      return new ApiError({ message: NETWORK_MESSAGE, isNetworkError: true });
    }
    const body = response.data as Record<string, unknown> | undefined;
    const code = typeof body?.code === 'string' ? (body.code as ErrorCode) : undefined;
    return new ApiError({
      message: messageFromBody(body) ?? fallbackMessage,
      status: response.status,
      code,
      data: body && typeof body === 'object' ? body : undefined,
      retryAfterSeconds: parseRetryAfter(response.headers?.['retry-after']),
    });
  }

  if (error instanceof Error && error.message) {
    return new ApiError({ message: error.message });
  }
  return new ApiError({ message: fallbackMessage });
}

/** Message to show the user for any thrown value. */
export function errorMessage(error: unknown, fallbackMessage = GENERIC_MESSAGE): string {
  return toApiError(error, fallbackMessage).message;
}

/** "Try again in 45 seconds" / "in 15 minutes" for rate-limit responses. */
export function retryAfterText(seconds: number | undefined): string {
  if (!seconds) return 'Please wait a moment and try again.';
  if (seconds < 90) return `Please try again in ${seconds} seconds.`;
  return `Please try again in ${Math.ceil(seconds / 60)} minutes.`;
}
