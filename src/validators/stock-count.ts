import { z } from 'zod';

export const startStockCountSchema = z.object({
  warehouseId: z.number().int().positive(),
  comment: z.string().max(2000).optional(),
});

export const stockCountActionSchema = z.object({
  action: z.enum(['complete', 'cancel']),
});

// Scanner workflow: each scan should ADD to the running count. If a wedge
// scanner clicks twice the operator notices the 2 vs 1 mismatch immediately
// — silently overwriting `countedQty` makes it look like only one unit
// was found.
export const scanSchema = z.object({
  code: z.string().min(1).max(200),
  quantity: z.number().int().positive('Кількість має бути більше нуля').default(1),
  // `set` overrides current counted; default `add` increments. Set is for
  // manual quantity-correction in the UI when the scanner over-scanned.
  mode: z.enum(['add', 'set']).default('add'),
});
