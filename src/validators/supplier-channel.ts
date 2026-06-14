import { z } from 'zod';
import { isSafeOutboundUrl } from '@/utils/safe-url';

const feedUrl = z
  .string()
  .url()
  .max(2000)
  .refine((u) => isSafeOutboundUrl(u, { protocols: ['http:', 'https:'] }), {
    message: 'URL вказує на приватну/локальну адресу — заборонено',
  });

const format = z.enum(['xlsx', 'csv', 'yml', 'xml_1c']);
const authType = z.enum(['none', 'basic', 'bearer']);
const syncMode = z.enum(['catalog_import', 'price_stock']);
const markupType = z.enum(['percent', 'fixed']);
const fulfillment = z.enum(['own_stock', 'dropship']);
const stockPolicy = z.enum(['hide', 'backorder']);

// markupValue covers both a percent (e.g. 30) and a flat UAH amount; the upper
// bound just guards against fat-finger garbage, not a real business limit.
const markupValue = z.number().min(0).max(1_000_000);
const minPrice = z.number().positive().max(99_999_999);
const notifyTelegramChatId = z.string().trim().max(64);
const notifyEmail = z.string().email().max(255);
const feedCurrencyRate = z.number().positive().max(1_000_000);

export const supplierChannelCreateSchema = z
  .object({
    name: z.string().min(1).max(255),
    feedUrl,
    format,
    authType: authType.default('none'),
    authUsername: z.string().max(255).optional().nullable(),
    authPassword: z.string().max(255).optional().nullable(),
    authToken: z.string().max(500).optional().nullable(),
    isActive: z.boolean().default(true),
    scheduleCron: z.string().max(100).optional().nullable(),
    // Consignment / dropship business rules.
    syncMode: syncMode.default('catalog_import'),
    markupType: markupType.default('percent'),
    markupValue: markupValue.default(0),
    fulfillment: fulfillment.default('own_stock'),
    stockPolicy: stockPolicy.default('hide'),
    minPrice: minPrice.optional().nullable(),
    notifyTelegramChatId: notifyTelegramChatId.optional().nullable(),
    notifyEmail: notifyEmail.optional().nullable(),
    feedCurrencyRate: feedCurrencyRate.default(1),
    reserveAware: z.boolean().default(false),
    zeroMissing: z.boolean().default(false),
  })
  .refine((d) => d.fulfillment !== 'dropship' || !!(d.notifyTelegramChatId || d.notifyEmail), {
    message: 'Для дропшипу вкажіть Telegram chat ID або email постачальника для сповіщень',
    path: ['notifyEmail'],
  });

export const supplierChannelUpdateSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    feedUrl: feedUrl.optional(),
    format: format.optional(),
    authType: authType.optional(),
    authUsername: z.string().max(255).optional().nullable(),
    authPassword: z.string().max(255).optional().nullable(),
    authToken: z.string().max(500).optional().nullable(),
    isActive: z.boolean().optional(),
    scheduleCron: z.string().max(100).optional().nullable(),
    syncMode: syncMode.optional(),
    markupType: markupType.optional(),
    markupValue: markupValue.optional(),
    fulfillment: fulfillment.optional(),
    stockPolicy: stockPolicy.optional(),
    minPrice: minPrice.optional().nullable(),
    notifyTelegramChatId: notifyTelegramChatId.optional().nullable(),
    notifyEmail: notifyEmail.optional().nullable(),
    feedCurrencyRate: feedCurrencyRate.optional(),
    reserveAware: z.boolean().optional(),
    zeroMissing: z.boolean().optional(),
  })
  .refine(
    // Only fires when a partial update actively switches to dropship while
    // explicitly clearing BOTH notify channels. Absent (undefined) fields pass —
    // the validator can't see the DB row, so an unchanged channel stays valid.
    (d) => {
      if (d.fulfillment !== 'dropship') return true;
      const tgSet = d.notifyTelegramChatId !== null && d.notifyTelegramChatId !== '';
      const emailSet = d.notifyEmail !== null && d.notifyEmail !== '';
      return tgSet || emailSet;
    },
    {
      message: 'Для дропшипу потрібен канал сповіщень (Telegram chat ID або email)',
      path: ['notifyEmail'],
    },
  );
