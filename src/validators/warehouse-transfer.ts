import { z } from 'zod';

// 500-item cap mirrors STOCK_BULK_LIMIT in validators/warehouse.ts —
// the heaviest transfer operation (ship/receive) does a per-item
// stock update under advisory lock, so unbounded N would freeze stock
// writes across the whole warehouse for the lock duration.
export const TRANSFER_ITEMS_LIMIT = 500;

const itemSchema = z.object({
  productId: z.number().int().positive('productId має бути додатнім числом'),
  quantity: z
    .number()
    .int()
    .positive('Кількість має бути більше нуля')
    .max(1_000_000, 'Кількість занадто велика'),
});

export const createTransferSchema = z
  .object({
    fromWarehouseId: z.number().int().positive(),
    toWarehouseId: z.number().int().positive(),
    comment: z.string().max(2000).optional(),
    items: z
      .array(itemSchema)
      .min(1, 'Додайте хоча б один товар')
      .max(TRANSFER_ITEMS_LIMIT, `Максимум ${TRANSFER_ITEMS_LIMIT} позицій за один transfer`),
  })
  .refine((d) => d.fromWarehouseId !== d.toWarehouseId, {
    message: 'Склад відправлення та одержання не може бути однаковим',
    path: ['toWarehouseId'],
  })
  // Reject duplicate productId rows before they hit the @@unique(transferId,
  // productId) DB constraint — gives a friendly message instead of a raw P2002.
  .refine((d) => new Set(d.items.map((i) => i.productId)).size === d.items.length, {
    message: 'Кожен товар можна додати лише один раз',
    path: ['items'],
  });

export const transferActionSchema = z.object({
  action: z.enum(['ship', 'receive', 'cancel', 'cancel-in-transit']),
  reason: z.string().max(500).optional(),
});
