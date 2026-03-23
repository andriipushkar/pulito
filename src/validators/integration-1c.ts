import { z } from 'zod';

export const oneCProductSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(500),
  category: z.string().max(200).optional(),
  priceRetail: z.number().nonnegative().optional(),
  priceWholesale: z.number().nonnegative().optional(),
  quantity: z.number().int().nonnegative().optional(),
  unit: z.string().max(20).optional(),
  barcode: z.string().max(50).optional(),
  description: z.string().max(5000).optional(),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

export const oneCProductsImportSchema = z.object({
  products: z.array(oneCProductSchema).min(1).max(10000),
});

export const oneCOrderStatusSchema = z.object({
  orderNumber: z.string().min(1),
  status: z.string().min(1),
  trackingNumber: z.string().optional(),
  comment: z.string().max(1000).optional(),
});

export const oneCOrderStatusBatchSchema = z.object({
  orders: z.array(oneCOrderStatusSchema).min(1).max(1000),
});

export const oneCStockItemSchema = z.object({
  code: z.string().min(1).max(50),
  quantity: z.number().int().nonnegative(),
  warehouseCode: z.string().max(50).optional(),
});

export const oneCStockUpdateSchema = z.object({
  stock: z.array(oneCStockItemSchema).min(1).max(10000),
});

export const oneCPriceItemSchema = z.object({
  code: z.string().min(1).max(50),
  priceRetail: z.number().nonnegative().optional(),
  priceWholesale: z.number().nonnegative().optional(),
  priceWholesale2: z.number().nonnegative().optional(),
  priceWholesale3: z.number().nonnegative().optional(),
});

export const oneCPriceUpdateSchema = z.object({
  prices: z.array(oneCPriceItemSchema).min(1).max(10000),
});

export type OneCProduct = z.infer<typeof oneCProductSchema>;
export type OneCOrderStatus = z.infer<typeof oneCOrderStatusSchema>;
export type OneCStockItem = z.infer<typeof oneCStockItemSchema>;
export type OneCPriceItem = z.infer<typeof oneCPriceItemSchema>;
