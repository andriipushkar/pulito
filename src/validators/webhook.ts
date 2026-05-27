import { z } from 'zod';

export const updateWebhookSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  // url validated by isSafeWebhookUrl in the route handler — schema only
  // enforces shape + max length here.
  url: z.string().max(2048).optional(),
  events: z.array(z.string().min(1).max(100)).max(50).optional(),
  isActive: z.boolean().optional(),
});
