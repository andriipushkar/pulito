import { z } from 'zod';

export const createReturnSchema = z.object({
  orderId: z.number().int().positive(),
  reason: z.enum(['defective', 'wrong_item', 'not_as_described', 'changed_mind', 'damaged_delivery', 'other']),
  description: z.string().max(2000).optional(),
  items: z.array(z.object({
    orderItemId: z.number().int().positive(),
    quantity: z.number().int().positive(),
  })).min(1),
});

export const processReturnSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  adminComment: z.string().max(1000).optional(),
});
