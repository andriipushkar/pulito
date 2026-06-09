import { z } from 'zod';
import { isSafeUrl } from '@/utils/safe-url';

export const PUBLICATION_CHANNELS = [
  'telegram',
  'facebook',
  'instagram',
  'tiktok',
  'site',
  'olx',
  'rozetka',
  'prom',
  'epicentrk',
] as const;

// Image paths must be internal uploads — pre-fix code accepted any string and
// composed `${appUrl}${imagePath}` to send to external APIs. Path traversal or
// an absolute URL would have leaked the upstream upload tree.
const imagePathSchema = z
  .string()
  .max(500)
  .refine(
    (v) => /^\/uploads\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/.test(v),
    'imagePath має починатися з /uploads/ і містити лише буквено-цифрові символи',
  )
  .optional()
  .nullable();

// Button URLs land on Telegram inline keyboards. Anything
// other than http(s) lets an admin (or compromised admin session) phish their
// own audience.
const buttonSchema = z.object({
  text: z.string().min(1).max(100),
  url: z
    .string()
    .max(500)
    .refine((v) => isSafeUrl(v), 'Посилання кнопки має бути http(s):// без приватних IP'),
});

export const createPublicationSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().max(20_000),
  channels: z.array(z.enum(PUBLICATION_CHANNELS)).min(1, 'Хоча б один канал'),
  scheduledAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .nullable()
    .refine(
      (v) => !v || new Date(v).getTime() > Date.now() - 60_000,
      'scheduledAt має бути у майбутньому (мін зараз - 1хв на лаг)',
    ),
  imagePath: imagePathSchema,
  additionalImages: z.array(imagePathSchema).max(10).optional(),
  buttons: z.array(buttonSchema).max(8).optional(),
  channelContents: z
    .record(
      z.string(),
      z.object({
        title: z.string().max(500).optional(),
        content: z.string().max(20_000).optional(),
        hashtags: z.string().max(1000).optional(),
      }),
    )
    .optional(),
  productIds: z.array(z.number().int().positive()).max(50).optional(),
  productId: z.number().int().positive().optional(),
  hashtags: z.string().max(1000).optional(),
  applyWatermark: z.boolean().optional(),
});
