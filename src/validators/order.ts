import { z } from 'zod';

export const addToCartSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1),
});

export const checkoutSchema = z.object({
  contactName: z.string().min(2, 'Мінімум 2 символи'),
  contactPhone: z.string().regex(/^\+380\d{9}$/, 'Введіть коректний номер телефону'),
  contactEmail: z.string().email('Невірний формат email'),
  companyName: z.string().optional(),
  edrpou: z.string().length(8, 'ЄДРПОУ має містити 8 цифр').optional(),
  deliveryMethod: z.enum(['nova_poshta', 'ukrposhta', 'pickup', 'pallet']),
  deliveryCity: z.string().optional(),
  deliveryWarehouseRef: z.string().optional(),
  deliveryAddress: z.string().optional(),
  paymentMethod: z.enum(['cod', 'bank_transfer', 'online', 'card_prepay']),
  comment: z.string().max(500).optional(),
  loyaltyPointsToSpend: z.number().int().min(0).optional(),
  paymentProvider: z.enum(['liqpay', 'monobank', 'wayforpay']).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const guestCartItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1),
});

export const guestCheckoutSchema = checkoutSchema.extend({
  items: z.array(guestCartItemSchema).min(1, 'Кошик порожній'),
});

export type GuestCheckoutInput = z.infer<typeof guestCheckoutSchema>;

export const orderFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum([
    'new_order', 'processing', 'confirmed', 'paid',
    'shipped', 'completed', 'cancelled', 'returned',
  ]).optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(['createdAt', 'totalAmount', 'status', 'orderNumber']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  paymentMethod: z.enum(['cod', 'bank_transfer', 'online', 'card_prepay']).optional(),
  deliveryMethod: z.enum(['nova_poshta', 'ukrposhta', 'pickup', 'pallet']).optional(),
});

export type OrderFilterInput = z.infer<typeof orderFilterSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'new_order', 'processing', 'confirmed', 'paid',
    'shipped', 'completed', 'cancelled', 'returned',
  ]),
  comment: z.string().max(500).optional(),
});
