import { z } from 'zod';

export const createReviewSchema = z.object({
  productId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  comment: z.string().max(2000).optional(),
  pros: z.string().max(500).optional(),
  cons: z.string().max(500).optional(),
});

export const moderateReviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

export const replyReviewSchema = z.object({
  adminReply: z.string().min(1).max(1000),
});
