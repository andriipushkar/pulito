import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import {
  getAllChannelConfigs,
  maskChannelConfig,
  saveChannelConfig,
  type ChannelType,
} from '@/services/channel-config';
import { z } from 'zod';

const CHANNELS: ChannelType[] = ['telegram', 'viber', 'facebook', 'instagram', 'tiktok'];

const telegramSchema = z.object({
  enabled: z.boolean(),
  botToken: z.string().min(1, 'Токен бота обов\'язковий'),
  channelId: z.string().min(1, 'ID каналу обов\'язковий'),
  managerChatId: z.string().optional(),
});

const viberSchema = z.object({
  enabled: z.boolean(),
  authToken: z.string().min(1, 'Auth Token обов\'язковий'),
});

const facebookSchema = z.object({
  enabled: z.boolean(),
  pageAccessToken: z.string().min(1, 'Page Access Token обов\'язковий'),
  pageId: z.string().min(1, 'Page ID обов\'язковий'),
});

const instagramSchema = z.object({
  enabled: z.boolean(),
  accessToken: z.string().min(1, 'Access Token обов\'язковий'),
  businessAccountId: z.string().min(1, 'Business Account ID обов\'язковий'),
  appId: z.string().optional(),
  appSecret: z.string().optional(),
});

const tiktokSchema = z.object({
  enabled: z.boolean(),
  accessToken: z.string().min(1, 'Access Token обов\'язковий'),
  openId: z.string().min(1, 'Open ID обов\'язковий'),
});

const schemas: Record<ChannelType, z.ZodSchema> = {
  telegram: telegramSchema,
  viber: viberSchema,
  facebook: facebookSchema,
  instagram: instagramSchema,
  tiktok: tiktokSchema,
};

export const GET = withRole('admin')(async () => {
  try {
    const configs = await getAllChannelConfigs();
    const masked: Record<string, unknown> = {};
    for (const ch of CHANNELS) {
      masked[ch] = maskChannelConfig(ch, configs[ch]);
    }
    return successResponse(masked);
  } catch {
    return errorResponse('Помилка завантаження налаштувань каналів', 500);
  }
});

export const PUT = withRole('admin')(async (req) => {
  try {
    const body = await req.json();
    const { channel, config } = body;

    if (!channel || !CHANNELS.includes(channel)) {
      return errorResponse('Невідомий канал');
    }

    const schema = schemas[channel as ChannelType];
    const parsed = schema.safeParse(config);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const firstError = Object.values(errors).flat()[0];
      return errorResponse(String(firstError || 'Невалідні дані'));
    }

    const userId = (req as unknown as { userId?: number }).userId;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await saveChannelConfig(channel as ChannelType, parsed.data as any, userId);

    return successResponse({ saved: true });
  } catch {
    return errorResponse('Помилка збереження налаштувань', 500);
  }
});
