import { z } from 'zod';
import { isSafeUrl } from '@/utils/safe-url';

export const createRoomSchema = z.object({
  subject: z.string().max(200).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Повідомлення не може бути порожнім').max(5000),
  // attachmentUrl lands in a chat bubble as `<a href={url}>` — z.url() lets
  // `javascript:` through, which an agent could weaponise into a phishing
  // link aimed at a customer. Force http(s)://.
  attachmentUrl: z
    .string()
    .max(2048)
    .refine((v) => isSafeUrl(v), 'attachmentUrl має бути http(s)://')
    .optional(),
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
