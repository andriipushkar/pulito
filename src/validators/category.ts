import { z } from 'zod';
import { isSafeUrl } from '@/utils/safe-url';

export const createCategorySchema = z.object({
  name: z
    .string()
    .min(2, 'Назва категорії має містити щонайменше 2 символи')
    .max(100, 'Назва категорії не може перевищувати 100 символів'),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug може містити лише малі літери, цифри та дефіс')
    .max(100)
    .optional(),
  description: z.string().max(2000).optional().nullable(),
  iconPath: z
    .string()
    .max(255)
    .refine(isSafeUrl, 'Недопустиме посилання на іконку')
    .optional()
    .nullable(),
  coverImage: z
    .string()
    .max(255)
    .refine(isSafeUrl, 'Недопустиме посилання на зображення')
    .optional()
    .nullable(),
  seoTitle: z.string().max(160).optional().nullable(),
  seoDescription: z.string().max(320).optional().nullable(),
  // EN translations
  nameEn: z.string().max(100).optional().nullable(),
  descriptionEn: z.string().max(2000).optional().nullable(),
  seoTitleEn: z.string().max(160).optional().nullable(),
  seoDescriptionEn: z.string().max(320).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isVisible: z.boolean().optional(),
  parentId: z.number().int().positive().optional().nullable(),
  version: z.number().int().nonnegative().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();
