import { z } from 'zod';

export const createVolumeDiscountSchema = z
  .object({
    productId: z.number().int().positive().optional().nullable(),
    categoryId: z.number().int().positive().optional().nullable(),
    minQuantity: z.number().int().positive({ message: 'Мінімальна кількість має бути більше 0' }),
    maxQuantity: z.number().int().positive().optional().nullable(),
    discountPercent: z.number().min(0).max(100, { message: 'Знижка не може перевищувати 100%' }),
    discountType: z.enum(['percentage', 'fixed_amount']).optional().default('percentage'),
    isActive: z.boolean().optional().default(true),
    priority: z.number().int().min(0).optional().default(0),
    startsAt: z.string().optional().nullable(),
    endsAt: z.string().optional().nullable(),
    stackableWith: z.array(z.string().max(50)).max(10).optional(),
  })
  .refine(
    (data) => data.productId || data.categoryId,
    { message: 'Потрібен productId або categoryId', path: ['productId'] }
  )
  .refine(
    (data) => !data.maxQuantity || data.maxQuantity >= data.minQuantity,
    { message: 'maxQuantity має бути >= minQuantity', path: ['maxQuantity'] }
  )
  .refine(
    (data) => !data.startsAt || !data.endsAt || new Date(data.startsAt) < new Date(data.endsAt),
    { message: 'startsAt має бути раніше за endsAt', path: ['endsAt'] }
  );

export type CreateVolumeDiscountInput = z.infer<typeof createVolumeDiscountSchema>;

export const updateVolumeDiscountSchema = z.object({
  productId: z.number().int().positive().optional().nullable(),
  categoryId: z.number().int().positive().optional().nullable(),
  minQuantity: z.number().int().positive().optional(),
  maxQuantity: z.number().int().positive().optional().nullable(),
  discountPercent: z.number().min(0).max(100).optional(),
  discountType: z.enum(['percentage', 'fixed_amount']).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  stackableWith: z.array(z.string().max(50)).max(10).optional(),
});

export type UpdateVolumeDiscountInput = z.infer<typeof updateVolumeDiscountSchema>;
