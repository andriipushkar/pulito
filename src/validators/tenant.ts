import { z } from 'zod';
import { isSafeUrl } from '@/utils/safe-url';

const RESERVED_TENANT_SLUGS = new Set([
  'admin',
  'api',
  'auth',
  'account',
  'cart',
  'catalog',
  'checkout',
  'login',
  'logout',
  'register',
  'search',
  'static',
  'uploads',
  '_next',
  'app',
  'system',
  'root',
  'www',
  'mail',
]);

// 16 KB ceiling on the settings JSON. A sensible tenant config fits here;
// anything larger is mis-use as a free key-value store.
const MAX_SETTINGS_JSON_BYTES = 16_384;

const settingsSchema = z
  .record(z.string(), z.unknown())
  .refine((v) => JSON.stringify(v ?? {}).length <= MAX_SETTINGS_JSON_BYTES, {
    message: `settings надто великий (макс ${MAX_SETTINGS_JSON_BYTES / 1024} KB)`,
  });

// Same RFC1034/1123 hostname format as /admin/domains keeps validation
// consistent across both endpoints.
const HOSTNAME_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export const createTenantSchema = z.object({
  name: z
    .string()
    .min(2, 'Назва має містити щонайменше 2 символи')
    .max(100, 'Назва не може перевищувати 100 символів'),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug може містити лише малі літери, цифри та дефіс')
    .min(2, 'Slug має містити щонайменше 2 символи')
    .max(63, 'Slug не може перевищувати 63 символи')
    .refine((s) => !RESERVED_TENANT_SLUGS.has(s), 'Цей slug зарезервовано системою'),
  domain: z
    .string()
    .max(255)
    .refine((v) => !v || HOSTNAME_REGEX.test(v), 'Невалідний домен (очікується example.com)')
    .optional()
    .nullable(),
  logoUrl: z
    .string()
    .max(500)
    .refine(
      (v) => !v || v.startsWith('/uploads/') || isSafeUrl(v),
      'logoUrl має бути /uploads/... або http(s)://',
    )
    .optional()
    .nullable(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Колір має бути у форматі #RRGGBB')
    .optional(),
  plan: z.enum(['free', 'basic', 'pro', 'enterprise']).optional(),
  isActive: z.boolean().optional(),
  settings: settingsSchema.optional().nullable(),
});

export const updateTenantSchema = createTenantSchema.partial();

export const addTenantUserSchema = z.object({
  userId: z.number().int().positive('userId має бути позитивним числом'),
  role: z.enum(['owner', 'admin', 'member']).optional(),
});
