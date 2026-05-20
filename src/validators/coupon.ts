import { z } from 'zod';

export const applyCouponSchema = z.object({
  code: z.string().min(1).max(50),
});

export const createCouponSchema = z
  .object({
    code: z.string().min(2).max(50).regex(/^[A-Za-z0-9_-]+$/, 'Код може містити лише латинські літери, цифри, _ та -'),
    description: z.string().max(500).optional(),
    type: z.enum(['percent', 'fixed_amount', 'free_delivery']),
    value: z.number().positive(),
    minOrderAmount: z.number().positive().optional(),
    maxDiscount: z.number().positive().optional(),
    usageLimit: z.number().int().positive().optional(),
    usageLimitPerUser: z.number().int().positive().optional(),
    validFrom: z.string().optional(),
    validUntil: z.string().optional(),
    applicableCategoryIds: z.array(z.number().int().positive()).max(200).optional(),
    excludedProductIds: z.array(z.number().int().positive()).max(2000).optional(),
    stackableWith: z.array(z.string().max(50)).max(10).optional(),
  })
  .refine(
    (d) => !d.validFrom || !d.validUntil || new Date(d.validFrom) < new Date(d.validUntil),
    { message: 'validFrom має бути раніше за validUntil', path: ['validUntil'] },
  );

export const updateCouponSchema = z
  .object({
    description: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
    usageLimit: z.number().int().positive().optional(),
    usageLimitPerUser: z.number().int().positive().optional(),
    maxDiscount: z.number().positive().optional(),
    validFrom: z.string().optional(),
    validUntil: z.string().optional(),
  })
  .refine(
    (d) => !d.validFrom || !d.validUntil || new Date(d.validFrom) < new Date(d.validUntil),
    { message: 'validFrom має бути раніше за validUntil', path: ['validUntil'] },
  );
