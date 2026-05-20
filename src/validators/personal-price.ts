import { z } from 'zod';

export const personalPriceFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.coerce.number().int().positive().optional(),
  productId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
});

export type PersonalPriceFilterInput = z.infer<typeof personalPriceFilterSchema>;

export const createPersonalPriceSchema = z
  .object({
    userId: z.number().int().positive(),
    productId: z.number().int().positive().optional(),
    categoryId: z.number().int().positive().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    fixedPrice: z.number().min(0).optional(),
    validFrom: z.string().optional(),
    validUntil: z.string().optional(),
    stackableWith: z.array(z.string().max(50)).max(10).optional(),
  })
  // Exactly one target (product XOR category) — otherwise a single rule would
  // try to apply to both scopes and tie-break logic gets ambiguous.
  .refine(
    (data) => Boolean(data.productId) !== Boolean(data.categoryId),
    { message: 'Вкажіть або productId, або categoryId — не обидва', path: ['productId'] },
  )
  // Exactly one discount kind (percent XOR fixed price) — same reason.
  .refine(
    (data) =>
      (data.discountPercent !== undefined) !== (data.fixedPrice !== undefined),
    {
      message: 'Вкажіть або discountPercent, або fixedPrice — не обидва',
      path: ['discountPercent'],
    },
  );

export type CreatePersonalPriceInput = z.infer<typeof createPersonalPriceSchema>;

export const updatePersonalPriceSchema = z
  .object({
    discountPercent: z.number().min(0).max(100).optional(),
    fixedPrice: z.number().min(0).optional(),
    validFrom: z.string().nullable().optional(),
    validUntil: z.string().nullable().optional(),
    stackableWith: z.array(z.string().max(50)).max(10).optional(),
  })
  .refine(
    (data) =>
      data.discountPercent === undefined ||
      data.fixedPrice === undefined,
    {
      message: 'Не можна одночасно встановлювати discountPercent та fixedPrice',
      path: ['discountPercent'],
    },
  );

export type UpdatePersonalPriceInput = z.infer<typeof updatePersonalPriceSchema>;
