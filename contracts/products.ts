// lib/contracts/products.ts — GET /api/products
import { z } from "zod";
import { objectId } from "./common";

export const productListQuery = z.object({
  /** Case-insensitive substring of the product name (max 100 chars). Alias: q. */
  search: z.string().max(100).optional(),
  /** true → only the admin's featured (hero) products, in featured order. */
  featured: z.enum(["true", "false"]).optional(),
  /** Category id or slug; a parent category includes its sub-categories. */
  category: z.string().optional(),
  origin: z.enum(["made-in-india", "foreign-made", "unspecified"]).optional(),
  shopId: objectId.optional(),
  /** Comma-separated product ids. */
  ids: z.string().optional(),
  exclude: objectId.optional(),
  page: z.coerce.number().int().min(1).default(1),
  /** Default 12, clamped to 100. */
  limit: z.coerce.number().int().min(1).max(100).default(12),
});
export type ProductListQuery = z.infer<typeof productListQuery>;

const ref = z.object({ _id: z.string() }).passthrough();

export const productSummary = z
  .object({
    _id: z.string(),
    name: z.string(),
    slug: z.string().optional(),
    price: z.number(),
    discountPrice: z.number().nullish(),
    image: z.string().nullish(),
    images: z.array(z.string()).optional(),
    stock: z.number().optional(),
    origin: z.string().optional(),
    category: z.union([ref.extend({ name: z.string().optional(), slug: z.string().optional() }), z.string(), z.null()]).optional(),
    shopId: z.union([ref.extend({ shopName: z.string().optional() }), z.string(), z.null()]).optional(),
    createdAt: z.string().optional(),
  })
  .passthrough();
export type ProductSummary = z.infer<typeof productSummary>;

export const pagination = z.object({
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  pages: z.number().int(),
  hasMore: z.boolean().optional(),
});
export type Pagination = z.infer<typeof pagination>;

export const productListResponse = z.object({
  products: z.array(productSummary),
  pagination,
});
export type ProductListResponse = z.infer<typeof productListResponse>;
