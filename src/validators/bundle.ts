import { z } from 'zod';

export const createBundleSchema = z.object({
  name: z
    .string()
    .min(2, 'Назва має містити щонайменше 2 символи')
    .max(200, 'Назва не може перевищувати 200 символів'),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug може містити лише малі літери, цифри та дефіс')
    .max(200)
    .optional(),
  description: z.string().max(2000).optional(),
  bundleType: z.enum(['curated', 'custom'], {
    errorMap: () => ({ message: 'Тип комплекту має бути curated або custom' }),
  }),
  discountPercent: z.number().min(0).max(100).optional(),
  fixedPrice: z.number().min(0).optional().nullable(),
  imagePath: z.string().max(255).optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive('ID товару має бути додатнім числом'),
        quantity: z.number().int().min(1, 'Кількість має бути щонайменше 1'),
      })
    )
    .min(1, 'Комплект повинен містити щонайменше один товар'),
});

export const updateBundleSchema = createBundleSchema.partial();
