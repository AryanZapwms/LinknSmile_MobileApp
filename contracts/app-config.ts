// lib/contracts/app-config.ts — GET /api/app-config
import { z } from "zod";

const semver = z.string().regex(/^\d+\.\d+\.\d+$/, "must be MAJOR.MINOR.PATCH");

export const appConfigResponse = z.object({
  /** Below this version the app must show a forced-update screen. */
  minSupportedAppVersion: z.object({ ios: semver, android: semver }),
  latestAppVersion: semver.nullable(),
  region: z.literal("IN"),
  currency: z.string(),
  support: z.object({ email: z.string(), phone: z.string() }),
  payments: z.object({ cod: z.boolean(), razorpay: z.boolean() }),
  links: z.object({
    website: z.string().url(),
    privacyPolicy: z.string().url(),
    terms: z.string().url(),
    refundPolicy: z.string().url(),
  }),
});
export type AppConfigResponse = z.infer<typeof appConfigResponse>;

/** True when `current` is older than `min` (both MAJOR.MINOR.PATCH). */
export function isBelowVersion(current: string, min: string): boolean {
  const a = current.split(".").map(Number);
  const b = min.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  }
  return false;
}
