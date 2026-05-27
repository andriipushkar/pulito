import { z } from 'zod';

export const adjustPointsSchema = z.object({
  userId: z.number().int().positive(),
  type: z.enum(['manual_add', 'manual_deduct']),
  // Cap single manual adjustment at 100k points (worth ≈ 10k UAH at a 0.1
  // UAH/point rate). Anything above is almost certainly a typo or a
  // compromised admin session — multi-step admin task should split into
  // separate adjusts rather than 1M-point one-shot.
  points: z.number().int().positive().max(100_000),
  description: z.string().min(1).max(500),
});

export type AdjustPointsInput = z.infer<typeof adjustPointsSchema>;

export const updateLoyaltyLevelSchema = z.object({
  name: z.string().min(1),
  minSpent: z.number().min(0),
  pointsMultiplier: z.number().min(0).default(1),
  discountPercent: z.number().min(0).max(100).default(0),
  benefits: z.record(z.string(), z.unknown()).nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export type UpdateLoyaltyLevelInput = z.infer<typeof updateLoyaltyLevelSchema>;

export const loyaltyTransactionFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type LoyaltyTransactionFilterInput = z.infer<typeof loyaltyTransactionFilterSchema>;
