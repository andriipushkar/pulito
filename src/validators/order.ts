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
  deliveryStreetRef: z.string().optional(),
  deliveryBuilding: z.string().optional(),
  deliveryFlat: z.string().optional(),
  paymentMethod: z.enum(['cod', 'bank_transfer', 'online', 'card_prepay']),
  comment: z.string().max(500).optional(),
  loyaltyPointsToSpend: z.number().int().min(0).optional(),
  paymentProvider: z
    .enum(['liqpay', 'liqpay_paypart', 'monobank', 'wayforpay', 'apple_pay', 'google_pay'])
    .optional(),
  // Pallet delivery: clients filling the PalletDeliveryForm send back the
  // calculated weight/region/cost so we can persist them on the Order. These
  // fields are only used when deliveryMethod === 'pallet'; the API silently
  // ignores them for other methods.
  palletWeightKg: z.number().positive().optional(),
  palletRegion: z.string().max(100).optional(),
  palletDeliveryCost: z.number().nonnegative().optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
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
  status: z
    .enum([
      'new_order',
      'processing',
      'confirmed',
      'paid',
      'packed',
      'shipped',
      'completed',
      'cancelled',
      'returned',
    ])
    .optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(['createdAt', 'totalAmount', 'status', 'orderNumber']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  // clientType is a Postgres enum on the column; passing an arbitrary
  // string used to reach Prisma which would crash with "invalid input
  // value for enum". Whitelist here so a malformed URL is a clean 400.
  clientType: z.enum(['retail', 'wholesale']).optional(),
  paymentMethod: z.enum(['cod', 'bank_transfer', 'online', 'card_prepay']).optional(),
  deliveryMethod: z.enum(['nova_poshta', 'ukrposhta', 'pickup', 'pallet']).optional(),
  paymentStatus: z.enum(['pending', 'paid', 'partial', 'refunded']).optional(),
  // Filter orders assigned to a specific manager. Useful when several
  // managers split a shift and each one wants to see only their workload.
  assignedManagerId: z.coerce.number().int().positive().optional(),
});

export type OrderFilterInput = z.infer<typeof orderFilterSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'new_order',
    'processing',
    'confirmed',
    'paid',
    'packed',
    'shipped',
    'completed',
    'cancelled',
    'returned',
  ]),
  comment: z.string().max(500).optional(),
});
