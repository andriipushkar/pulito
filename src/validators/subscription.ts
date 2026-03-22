import { z } from 'zod';

const subscriptionItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1, 'Мінімальна кількість — 1'),
});

export const createSubscriptionSchema = z.object({
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'bimonthly']),
  items: z.array(subscriptionItemSchema).min(1, 'Додайте хоча б один товар'),
  deliveryMethod: z.string().optional(),
  deliveryCity: z.string().optional(),
  deliveryAddress: z.string().optional(),
  paymentMethod: z.string().optional(),
});

export const updateSubscriptionSchema = z.object({
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'bimonthly']).optional(),
  items: z.array(subscriptionItemSchema).min(1, 'Додайте хоча б один товар').optional(),
  status: z.enum(['active', 'paused', 'cancelled']).optional(),
  deliveryMethod: z.string().optional(),
  deliveryCity: z.string().optional(),
  deliveryAddress: z.string().optional(),
  paymentMethod: z.string().optional(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
