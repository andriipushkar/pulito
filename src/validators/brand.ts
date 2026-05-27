import { z } from 'zod';
import { isSafeUrl } from '@/utils/safe-url';

// Slugs that would collide with first-class route segments. Admin could
// otherwise create a brand whose page lives at /brand/admin — confusing
// at best, a phishing vector at worst.
const RESERVED_BRAND_SLUGS = new Set([
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
]);

// website is rendered in PrintableOrder + (future) brand page as `<a href>`.
// `z.string().url()` happily accepts `javascript:alert(1)` because URL spec
// considers it valid — we explicitly require an http(s) scheme.
const safeWebsite = z
  .string()
  .max(500)
  .refine(
    (v) => v === '' || isSafeUrl(v),
    'Веб-сайт має бути http(s):// — без javascript:, data:, приватних IP',
  )
  .optional()
  .nullable()
  .or(z.literal(''));

// logoPath must be a relative `/uploads/...` path or absolute http(s).
// Anything else (e.g. javascript:) is a sign of a tampered request.
const safeLogoPath = z
  .string()
  .max(500)
  .refine(
    (v) => v === '' || v.startsWith('/uploads/') || isSafeUrl(v),
    'logoPath має бути /uploads/... або http(s)://',
  )
  .optional()
  .nullable();

export const createBrandSchema = z.object({
  name: z.string().min(1, "Назва обов'язкова").max(255, 'Назва до 255 символів'),
  slug: z
    .string()
    .min(1, 'Slug не може бути порожнім')
    .regex(/^[a-z0-9-]+$/, 'Slug — лише малі латинські літери, цифри, дефіс')
    .max(255)
    .refine((s) => !RESERVED_BRAND_SLUGS.has(s), 'Цей slug зарезервовано системою')
    .optional(),
  description: z.string().max(2000).optional().nullable(),
  logoPath: safeLogoPath,
  website: safeWebsite,
  country: z.string().max(100).optional().nullable(),
  seoTitle: z.string().max(70).optional().nullable(),
  seoDescription: z.string().max(160).optional().nullable(),
  nameEn: z.string().max(255).optional().nullable(),
  descriptionEn: z.string().max(2000).optional().nullable(),
  seoTitleEn: z.string().max(70).optional().nullable(),
  seoDescriptionEn: z.string().max(160).optional().nullable(),
  isVisible: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  // Optimistic concurrency token; PUT rejects with 409 on mismatch.
  version: z.number().int().nonnegative().optional(),
});

export const updateBrandSchema = createBrandSchema.partial();
