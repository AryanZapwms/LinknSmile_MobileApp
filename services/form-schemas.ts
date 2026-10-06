// services/form-schemas.ts
// Client-side validation for forms whose rules are NOT in ../contracts yet.
// Each schema mirrors the server code named above it; if the server rule
// changes, change it here too (or, better, move the schema into the web
// repo's lib/contracts and sync it).

import { z } from 'zod';

const name = z.string().trim().min(2, 'Name must be at least 2 characters');
const email = z.string().trim().toLowerCase().email('Enter a valid email address');
const password = z.string().min(6, 'Password must be at least 6 characters');
/** Indian mobile number: 10 digits. */
const phone = z.string().trim().regex(/^\d{10}$/, 'Enter a 10-digit mobile number');
/** Indian PIN code: 6 digits. */
const pincode = z.string().trim().regex(/^\d{6}$/, 'Enter a 6-digit PIN code');
const required = (label: string) => z.string().trim().min(1, `${label} is required`);

const passwordsMatch = (data: { password: string; confirmPassword: string }) =>
  data.password === data.confirmPassword;
const passwordsMatchError = { message: "Passwords don't match", path: ['confirmPassword'] };

// Web: lib/validation.ts `registerSchema` (POST /api/auth/register).
// The server also requires role "user"; the API client adds it.
export const customerRegisterSchema = z
  .object({ name, email, password, confirmPassword: z.string() })
  .refine(passwordsMatch, passwordsMatchError);
export type CustomerRegisterForm = z.infer<typeof customerRegisterSchema>;

// Web: app/api/auth/register-vendor/route.ts (requires name, email, password,
// shopName, street, city, state, pincode) and the website's seller form,
// which also requires a phone number (the shop record needs one).
export const vendorRegisterSchema = z
  .object({
    name,
    email,
    phone,
    password,
    confirmPassword: z.string(),
    shopName: z.string().trim().min(2, 'Shop name must be at least 2 characters'),
    description: z.string().trim().optional(),
    street: required('Street address'),
    city: required('City'),
    state: required('State'),
    pincode,
    gstNumber: z.string().trim().toUpperCase().optional(),
    panNumber: z.string().trim().toUpperCase().optional(),
  })
  .refine(passwordsMatch, passwordsMatchError);
export type VendorRegisterForm = z.infer<typeof vendorRegisterSchema>;

// Web: app/api/auth/forgot-password/route.ts
export const forgotPasswordSchema = z.object({ email });

// Web: app/api/auth/reset-password/route.ts (newPassword at least 6 characters).
export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine(passwordsMatch, passwordsMatchError);

// Delivery address, India: ../contracts `shippingAddress` / `addressCreateRequest`
// only require non-empty strings; the phone and PIN formats are India rules.
export const addressFormSchema = z.object({
  name: required('Full name'),
  phone,
  street: required('Address'),
  city: required('City'),
  state: required('State'),
  pincode,
});
export type AddressForm = z.infer<typeof addressFormSchema>;

/** First error message per field, for showing under each input. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? 'form');
    errors[field] ??= issue.message;
  }
  return errors;
}
