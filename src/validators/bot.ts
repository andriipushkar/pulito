import { z } from 'zod';
import { isSafeUrl } from '@/utils/safe-url';

// Same surface area as publication-template buttons — when fired, the
// button URL lands on Telegram inline keyboards.
// `z.url()` accepts `javascript:`, so we explicitly require http(s).
const buttonUrlSchema = z
  .string()
  .max(500)
  .refine((v) => isSafeUrl(v), 'Посилання кнопки має бути http(s):// без приватних IP');

export const updateBotReplySchema = z.object({
  platform: z.enum(['all', 'telegram', 'instagram', 'facebook']).optional(),
  triggerType: z.enum(['partial', 'exact', 'regex']).optional(),
  // Cap regex pattern length — `(.+)+$` style ReDoS gadgets are short, but
  // capping makes them harder to fit while leaving legitimate patterns
  // (most are <50 chars) intact.
  triggerText: z.string().max(500).nullable().optional(),
  responseText: z.string().min(1).max(4096).optional(),
  responseImage: z.string().max(500).nullable().optional(),
  buttons: z
    .array(
      z.object({
        text: z.string().min(1).max(64),
        url: buttonUrlSchema.optional(),
        callback: z.string().max(128).optional(),
      }),
    )
    .max(10)
    .nullable()
    .optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
});
