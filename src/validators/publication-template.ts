import { z } from 'zod';
import { isSafeUrl } from '@/utils/safe-url';

export const TEMPLATE_CHANNELS = ['telegram', 'instagram', 'facebook', 'tiktok', 'site'] as const;

// Same surface area as publication buttons — when the template is applied,
// the buttons land on Telegram inline keyboards. A
// `javascript:` URL would otherwise sneak from template into every
// publication created from it.
const buttonSchema = z.object({
  text: z.string().min(1).max(100),
  url: z
    .string()
    .max(500)
    .refine((v) => isSafeUrl(v), 'Посилання кнопки має бути http(s):// без приватних IP'),
});

const channelBlockSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().max(20_000).optional(),
  hashtags: z.string().max(1000).optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(2, 'Назва шаблону обовʼязкова (мін. 2 символи)').max(200),
  description: z.string().max(2000).optional().nullable(),
  channels: z.array(z.enum(TEMPLATE_CHANNELS)).min(1, 'Шаблон має містити хоча б один канал'),
  titleTemplate: z.string().max(500).optional().nullable(),
  contentTemplate: z.string().min(1, 'Зміст шаблону обовʼязковий').max(20_000),
  hashtagsTemplate: z.string().max(1000).optional().nullable(),
  channelContents: z.record(z.string(), channelBlockSchema).optional().nullable(),
  buttons: z.array(buttonSchema).max(8).optional().nullable(),
  firstComment: z.string().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const applyTemplateSchema = z.object({
  productId: z.number().int().positive().optional().nullable(),
});
