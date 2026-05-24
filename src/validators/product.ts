import { z } from 'zod';
import { isValidGtin } from '@/utils/gtin';

export const productFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
  // Comma-separated brand slugs. The catalog's filter sidebar lets the user
  // tick multiple brands at once; we accept them all in a single param.
  brand: z.string().optional(),
  search: z.string().min(2).max(200).optional(),
  barcode: z
    .string()
    .regex(/^\d{8,14}$/)
    .optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  promo: z.coerce.boolean().optional(),
  inStock: z.coerce.boolean().optional(),
  sort: z
    .enum(['popular', 'price_asc', 'price_desc', 'name_asc', 'newest', 'brand_asc', 'brand_desc'])
    .default('popular'),
});

export type ProductFilterInput = z.infer<typeof productFilterSchema>;

export const createProductSchema = z.object({
  code: z
    .string()
    .min(1, "Код товару обов'язковий")
    .max(50, 'Код товару не може перевищувати 50 символів'),
  barcode: z
    .string()
    .refine(
      (v) => v === '' || isValidGtin(v),
      'Невірна контрольна цифра штрихкоду (GS1 checksum). Перевірте, чи всі цифри введені правильно.',
    )
    .optional()
    .nullable()
    .or(z.literal('')),
  name: z
    .string()
    .min(2, 'Назва товару має містити щонайменше 2 символи')
    .max(255, 'Назва товару не може перевищувати 255 символів'),
  slug: z
    .string()
    .max(255, 'Slug не може перевищувати 255 символів')
    .regex(/^[a-z0-9-]*$/, 'Slug може містити лише малі латинські літери, цифри й дефіс')
    .optional()
    .nullable(),
  categoryId: z.number().int().positive().optional().nullable(),
  priceRetail: z.number().min(0, "Ціна не може бути від'ємною"),
  priceRetailOld: z.number().min(0).optional().nullable(),
  priceWholesale: z.number().min(0).optional().nullable(),
  priceWholesale2: z.number().min(0).optional().nullable(),
  priceWholesale3: z.number().min(0).optional().nullable(),
  quantity: z.number().int().min(0).default(0),
  hideQuantity: z.boolean().default(false),
  isPromo: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  description: z.string().max(2000).optional().nullable(),
  descriptionHtml: z.string().max(50000).optional().nullable(),
  specifications: z.string().max(50000).optional().nullable(),
  seoTitle: z.string().max(70, 'SEO title до 70 символів').optional().nullable(),
  seoDescription: z.string().max(160, 'SEO description до 160 символів').optional().nullable(),
  brandId: z.number().int().positive().optional().nullable(),
  // Accept ISO date-time strings; the service coerces to Date.
  promoStartDate: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/))
    .optional()
    .nullable(),
  promoEndDate: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/))
    .optional()
    .nullable(),
  // Physical parameters — used by carrier TTN + margin reports.
  weightGrams: z.number().int().min(0).max(1_000_000).optional().nullable(),
  lengthMm: z.number().int().min(0).max(10_000).optional().nullable(),
  widthMm: z.number().int().min(0).max(10_000).optional().nullable(),
  heightMm: z.number().int().min(0).max(10_000).optional().nullable(),
  cost: z.number().min(0).optional().nullable(),
  // Optimistic concurrency token (server enforces match + increment).
  version: z.number().int().nonnegative().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const searchAutocompleteSchema = z.object({
  q: z.string().min(2).max(200),
});
