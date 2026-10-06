// services/monitoring.ts
// Crash and error reporting (Sentry). Everything here is a no-op until
// EXPO_PUBLIC_SENTRY_DSN is set, so the app behaves the same without it.
//
// Privacy: only the user's id is attached to reports, never their name,
// email, phone, address or tokens (`sendDefaultPii` is off).

import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';
import { SENTRY_DSN } from './config';

const enabled = Boolean(SENTRY_DSN);

/** Call once, before the app renders. */
export function initMonitoring() {
  if (!enabled) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    enabled: !__DEV__, // development errors stay on the developer's screen
    sendDefaultPii: false,
    // Crash reporting only for now; performance tracing can be turned on later.
    tracesSampleRate: 0,
  });
}

/** Wraps the root component so native crashes and unhandled errors are captured. */
export function withMonitoring<P extends Record<string, unknown>>(Root: ComponentType<P>): ComponentType<P> {
  return enabled ? Sentry.wrap(Root) : Root;
}

/** Ties reports to an account id (or clears it on sign-out). */
export function setMonitoringUser(userId: string | null) {
  if (!enabled) return;
  Sentry.setUser(userId ? { id: userId } : null);
}

/** Reports an error the app caught and recovered from. */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (!enabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
