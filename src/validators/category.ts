import { z } from 'zod';

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
  iconPath: z.string().max(255).optional().nullable(),
  coverImage: z.string().max(255).optional().nullable(),
  seoTitle: z.string().max(160).optional().nullable(),
  seoDescription: z.string().max(320).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isVisible: z.boolean().optional(),
  parentId: z.number().int().positive().optional().nullable(),
  version: z.number().int().nonnegative().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();
