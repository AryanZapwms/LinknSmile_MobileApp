// services/form-schemas.ts: the sign-up forms accept what the server accepts
// and reject what it rejects.
import { z } from 'zod';
import { customerRegisterSchema, fieldErrors, vendorRegisterSchema } from '../services/form-schemas';

// TEMPORARY COPY of the web repo's `registerSchema` (lib/validation.ts), the
// rule POST /api/auth/register applies. It lives here only until that schema
// is published in the web repo's lib/contracts; then delete this copy and
// import it from '../contracts' so the check follows the server automatically.
const serverRegisterSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
    role: z.literal('user'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

const customer = { name: 'Asha Rao', email: ' Asha@Example.com ', password: 'secret1', confirmPassword: 'secret1' };

describe('customer registration form', () => {
  it('accepts a valid form, and what the app then sends passes the server rule', () => {
    const form = customerRegisterSchema.safeParse(customer);
    expect(form.success).toBe(true);
    // The API client adds role "user" to the parsed form (apiClient.auth.registerCustomer).
    const sent = { ...form.data, role: 'user' };
    expect(serverRegisterSchema.safeParse(sent).success).toBe(true);
  });

  it('trims and lower-cases the email before it is sent', () => {
    expect(customerRegisterSchema.parse(customer).email).toBe('asha@example.com');
  });

  it('the payload old app versions sent (role "customer", no confirmPassword) fails the server rule', () => {
    const oldPayload = { name: 'A B', email: 'a@b.co', password: 'secret1', role: 'customer' };
    expect(serverRegisterSchema.safeParse(oldPayload).success).toBe(false);
  });

  it.each([
    ['a one-letter name', { ...customer, name: 'A' }],
    ['a malformed email', { ...customer, email: 'nope' }],
    ['a 3-character password', { ...customer, password: '123', confirmPassword: '123' }],
    ['passwords that differ', { ...customer, confirmPassword: 'other12' }],
  ])('rejects %s, exactly as the server does', (_label, form) => {
    expect(customerRegisterSchema.safeParse(form).success).toBe(false);
    expect(serverRegisterSchema.safeParse({ ...form, role: 'user' }).success).toBe(false);
  });

  it('reports errors keyed by field', () => {
    const result = customerRegisterSchema.safeParse({ ...customer, confirmPassword: 'x' });
    expect(result.success).toBe(false);
    expect(fieldErrors(result.error!).confirmPassword).toBe("Passwords don't match");
  });
});

const vendor = {
  ...customer,
  phone: '9876543210',
  shopName: 'Asha Handlooms',
  description: '',
  street: '12 MG Road',
  city: 'Pune',
  state: 'Maharashtra',
  pincode: '411001',
  gstNumber: '',
  panNumber: ' abcde1234f ',
};

/** What app/api/auth/register-vendor/route.ts refuses to work without. */
const SERVER_REQUIRED = ['name', 'email', 'password', 'shopName', 'street', 'city', 'state', 'pincode'] as const;

describe('seller registration form', () => {
  it('accepts a valid form carrying every field the server requires', () => {
    const form = vendorRegisterSchema.safeParse(vendor);
    expect(form.success).toBe(true);
    for (const field of SERVER_REQUIRED) expect(form.data?.[field]).toBeTruthy();
  });

  it('upper-cases the PAN', () => {
    expect(vendorRegisterSchema.parse(vendor).panNumber).toBe('ABCDE1234F');
  });

  it.each(['shopName', 'street', 'city', 'state', 'pincode', 'phone'])('rejects an empty %s', (field) => {
    expect(vendorRegisterSchema.safeParse({ ...vendor, [field]: '' }).success).toBe(false);
  });

  it('rejects a 5-digit PIN code', () => {
    expect(vendorRegisterSchema.safeParse({ ...vendor, pincode: '41100' }).success).toBe(false);
  });
});
