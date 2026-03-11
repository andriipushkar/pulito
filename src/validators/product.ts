import { z } from 'zod';

export const productFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
  search: z.string().min(2).max(200).optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  promo: z.coerce.boolean().optional(),
  inStock: z.coerce.boolean().optional(),
  sort: z
    .enum(['popular', 'price_asc', 'price_desc', 'name_asc', 'newest'])
    .default('popular'),
});

export type ProductFilterInput = z.infer<typeof productFilterSchema>;

export const createProductSchema = z.object({
  code: z
    .string()
    .min(1, 'Код товару обов\'язковий')
    .max(50, 'Код товару не може перевищувати 50 символів'),
  name: z
    .string()
    .min(2, 'Назва товару має містити щонайменше 2 символи')
    .max(255, 'Назва товару не може перевищувати 255 символів'),
  categoryId: z.number().int().positive().optional().nullable(),
  priceRetail: z.number().min(0, 'Ціна не може бути від\'ємною'),
  priceWholesale: z.number().min(0).optional().nullable(),
  priceWholesale2: z.number().min(0).optional().nullable(),
  priceWholesale3: z.number().min(0).optional().nullable(),
  quantity: z.number().int().min(0).default(0),
  isPromo: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateProductSchema = createProductSchema.partial();

export const searchAutocompleteSchema = z.object({
  q: z.string().min(2).max(200),
});
