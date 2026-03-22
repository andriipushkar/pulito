import { z } from 'zod';

export const createWarehouseSchema = z.object({
  name: z.string().min(2, 'Мінімум 2 символи').max(200),
  code: z.string().min(1, 'Код обов\'язковий').max(50).regex(/^[A-Za-z0-9_-]+$/, 'Код може містити лише латиницю, цифри, _ та -'),
  city: z.string().min(2, 'Місто обов\'язкове').max(100),
  address: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().optional().default(false),
});

export const updateWarehouseSchema = z.object({
  name: z.string().min(2, 'Мінімум 2 символи').max(200).optional(),
  code: z.string().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/, 'Код може містити лише латиницю, цифри, _ та -').optional(),
  city: z.string().min(2).max(100).optional(),
  address: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().optional(),
});

export const updateStockSchema = z.object({
  items: z.array(
    z.object({
      productId: z.number().int().positive('productId має бути додатнім числом'),
      quantity: z.number().int().min(0, 'Кількість не може бути від\'ємною'),
    })
  ).min(1, 'Потрібен хоча б один товар'),
});
