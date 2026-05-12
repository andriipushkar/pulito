import { z } from 'zod';

export const createBrandSchema = z.object({
  name: z.string().min(1, "Назва обов'язкова").max(255, 'Назва до 255 символів'),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug — лише малі латинські літери, цифри, дефіс')
    .max(255)
    .optional(),
  description: z.string().max(2000).optional().nullable(),
  logoPath: z.string().max(500).optional().nullable(),
  isVisible: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateBrandSchema = createBrandSchema.partial();
