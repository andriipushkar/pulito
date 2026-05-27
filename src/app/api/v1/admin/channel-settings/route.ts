import { withRole2fa } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import {
  getAllChannelConfigs,
  maskChannelConfig,
  saveChannelConfig,
  type ChannelType,
} from '@/services/channel-config';
import { z } from 'zod';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

type ChannelConfigInput = Parameters<typeof saveChannelConfig>[1];

const CHANNELS: ChannelType[] = [
  'telegram',
  'viber',
  'facebook',
  'instagram',
  'tiktok',
  'olx',
  'rozetka',
  'prom',
  'epicentrk',
];

const telegramSchema = z.object({
  enabled: z.boolean(),
  botToken: z.string().min(1, "Токен бота обов'язковий"),
  channelId: z.string().min(1, "ID каналу обов'язковий"),
  managerChatId: z.string().optional(),
});

const viberSchema = z.object({
  enabled: z.boolean(),
  authToken: z.string().min(1, "Auth Token обов'язковий"),
});

const facebookSchema = z.object({
  enabled: z.boolean(),
  pageAccessToken: z.string().min(1, "Page Access Token обов'язковий"),
  pageId: z.string().min(1, "Page ID обов'язковий"),
});

const instagramSchema = z.object({
  enabled: z.boolean(),
  accessToken: z.string().min(1, "Access Token обов'язковий"),
  businessAccountId: z.string().min(1, "Business Account ID обов'язковий"),
  appId: z.string().optional(),
  appSecret: z.string().optional(),
});

const tiktokSchema = z.object({
  enabled: z.boolean(),
  accessToken: z.string().min(1, "Access Token обов'язковий"),
  openId: z.string().min(1, "Open ID обов'язковий"),
});

// Marketplace integrations share a credential shape. Explicit allow-list —
// pre-fix `.passthrough()` accepted any field name, which let an admin slip
// arbitrary keys into the JSON (DB bloat + potential SSRF if downstream code
// ever reads a custom URL field).
const marketplaceSchema = z.object({
  enabled: z.boolean(),
  apiKey: z.string().max(500).optional(),
  apiSecret: z.string().max(500).optional(),
  apiToken: z.string().max(500).optional(),
  accessToken: z.string().max(500).optional(),
  refreshToken: z.string().max(500).optional(),
  clientId: z.string().max(200).optional(),
  clientSecret: z.string().max(500).optional(),
  sellerId: z.union([z.string().max(100), z.number().int().positive()]).optional(),
  username: z.string().max(200).optional(),
  password: z.string().max(500).optional(),
});

const schemas: Record<ChannelType, z.ZodSchema> = {
  telegram: telegramSchema,
  viber: viberSchema,
  facebook: facebookSchema,
  instagram: instagramSchema,
  tiktok: tiktokSchema,
  olx: marketplaceSchema,
  rozetka: marketplaceSchema,
  prom: marketplaceSchema,
  epicentrk: marketplaceSchema,
};

export const GET = withRole2fa('admin')(async () => {
  try {
    const configs = await getAllChannelConfigs();
    const masked: Record<string, unknown> = {};
    for (const ch of CHANNELS) {
      masked[ch] = maskChannelConfig(ch, configs[ch]);
    }
    return successResponse(masked);
  } catch (err) {
    logger.error('[admin/channel-settings GET] failed', { error: err });
    return errorResponse('Помилка завантаження налаштувань каналів', 500);
  }
});

export const PUT = withRole2fa('admin')(async (req, { user }) => {
  try {
    const body = await req.json();
    const { channel, config } = body;

    if (!channel || !CHANNELS.includes(channel)) {
      return errorResponse('Невідомий канал', 400);
    }

    const schema = schemas[channel as ChannelType];
    const parsed = schema.safeParse(config);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const firstError = Object.values(errors).flat()[0];
      return errorResponse(String(firstError || 'Невалідні дані'), 422);
    }

    // Reject submissions where the secret-bearing fields still contain the
    // bullet-masked placeholder — that means the admin opened the form and
    // saved without typing a real value. Overwriting the encrypted secret
    // with the mask would brick the integration.
    const data = parsed.data as Record<string, unknown>;
    const SECRET_FIELDS = [
      'botToken',
      'authToken',
      'pageAccessToken',
      'accessToken',
      'appSecret',
      'webhookSecret',
      'apiKey',
      'clientSecret',
    ];
    for (const f of SECRET_FIELDS) {
      if (typeof data[f] === 'string' && /•{4,}/.test(data[f] as string)) {
        delete data[f];
      }
    }

    await saveChannelConfig(channel as ChannelType, data as ChannelConfigInput, user.id);

    await logAudit({
      userId: user.id,
      actionType: 'rule_change',
      entityType: 'settings',
      details: {
        scope: 'channel',
        channel,
        enabled: (parsed.data as { enabled?: boolean }).enabled,
      },
      ipAddress: getClientIp(req),
    });

    return successResponse({ saved: true });
  } catch (err) {
    logger.error('[admin/channel-settings PUT] failed', { error: err });
    return errorResponse('Помилка збереження налаштувань', 500);
  }
});
