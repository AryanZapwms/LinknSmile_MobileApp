// lib/contracts/customer.ts — profile, password, addresses, cart, favourites.
// Existing routes return Mongoose documents, so response schemas list the
// fields the app relies on and pass the rest through.
import { z } from "zod";
import { objectId } from "./common";

// GET/PUT /api/users/profile
export const profileResponse = z
  .object({
    name: z.string(),
    email: z.string(),
    phone: z.string().nullish(),
    image: z.string().nullable(),
    address: z.string(),
    city: z.string(),
    state: z.string(),
    pincode: z.string(),
    role: z.enum(["user", "admin", "shop_owner"]),
    pendingVendorApplication: z.boolean(),
  })
  .passthrough();
export type ProfileResponse = z.infer<typeof profileResponse>;

export const profileUpdateRequest = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  /** data:image/...;base64,... */
  imageBase64: z.string().optional(),
});
export type ProfileUpdateRequest = z.infer<typeof profileUpdateRequest>;

// POST /api/auth/change-password
export const changePasswordRequest = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequest>;
export const changePasswordResponse = z.object({ message: z.string() });

// /api/addresses, /api/addresses/:id
export const address = z
  .object({
    _id: z.string(),
    label: z.enum(["Home", "Work", "Other"]),
    name: z.string(),
    phone: z.string(),
    street: z.string(),
    city: z.string(),
    state: z.string(),
    pincode: z.string(),
    isDefault: z.boolean(),
  })
  .passthrough();
export type AddressDto = z.infer<typeof address>;
export const addressListResponse = z.array(address);
export const addressCreateRequest = z.object({
  label: z.enum(["Home", "Work", "Other"]).optional(),
  name: z.string().min(1),
  phone: z.string().min(1),
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(1),
  isDefault: z.boolean().optional(),
});
export type AddressCreateRequest = z.infer<typeof addressCreateRequest>;
export const addressUpdateRequest = addressCreateRequest.partial();

// /api/cart
export const cartItem = z
  .object({
    productId: z.string(),
    name: z.string(),
    slug: z.string(),
    price: z.number(),
    discountPrice: z.number().nullish(),
    image: z.string().nullish(),
    quantity: z.number().int().min(1),
    stock: z.number(),
    shopId: z.string(),
    shopName: z.string(),
    selectedSize: z
      .object({ size: z.string().optional(), unit: z.string().optional(), quantity: z.number().optional(), price: z.number().optional(), discountPrice: z.number().nullish(), stock: z.number().optional() })
      .nullish(),
  })
  .passthrough();
export type CartItemDto = z.infer<typeof cartItem>;
export const cartGetResponse = z.object({
  items: z.array(cartItem),
  cart: z.object({ items: z.array(cartItem), totalPrice: z.number() }).passthrough(),
}).passthrough();
/** Replaces the whole cart; prices/stock are re-read from the DB. */
export const cartPutRequest = z.object({
  items: z.array(
    z.object({ productId: objectId, name: z.string(), slug: z.string(), image: z.string().optional(), quantity: z.number().int().min(1), selectedSize: z.object({ size: z.string(), quantity: z.number() }).passthrough().nullish() }).passthrough()
  ),
});
export const cartPostResponse = z.object({ cart: z.object({ items: z.array(cartItem) }).passthrough() });

// /api/favourites (use this, not the legacy /api/wishlist)
export const favourite = z.object({ _id: z.string(), type: z.enum(["product", "seller"]), refId: z.string() }).passthrough();
export const favouriteListResponse = z.array(favourite);
export const favouriteToggleRequest = z.object({ type: z.enum(["product", "seller"]), refId: objectId });
export const favouriteToggleResponse = z.object({ added: z.boolean() });
