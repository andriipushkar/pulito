import { z } from 'zod';

export const createRoomSchema = z.object({
  subject: z.string().max(200).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Повідомлення не може бути порожнім').max(5000),
  attachmentUrl: z.string().url().optional(),
});

export const adminChatFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['open', 'assigned', 'resolved', 'closed']).optional(),
  search: z.string().max(100).optional(),
});

export const adminChatUpdateSchema = z.object({
  action: z.enum(['assign', 'resolve', 'close']),
  agentId: z.number().int().optional(),
});
