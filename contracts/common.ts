// lib/contracts/common.ts — building blocks shared by the contract files.
import { z } from "zod";
import { ERROR_CODES } from "./errors";

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "must be a 24-character hex id");

/** Every error body from a mobile-facing route. */
export const apiErrorBody = z
  .object({
    error: z.string(),
    code: z.enum(ERROR_CODES),
  })
  .passthrough();
export type ApiErrorBody = z.infer<typeof apiErrorBody>;

export const successTrue = z.object({ success: z.literal(true) });
