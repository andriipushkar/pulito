import { z } from 'zod';
import { isSafeUrl } from '@/utils/safe-url';

export const createBlogPostSchema = z.object({
  title: z
    .string()
    .min(2, 'Заголовок має містити щонайменше 2 символи')
    .max(200, 'Заголовок не може перевищувати 200 символів'),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug може містити лише малі літери, цифри та дефіс')
    .max(200)
    .optional(),
  content: z.string().min(1, 'Контент є обовʼязковим'),
  excerpt: z.string().max(500).optional(),
  // Cover image URL — same allow-list as banner image helpers. Blocks
  // `javascript:`, `data:image/svg+xml;...` (XSS via inline SVG `<script>`),
  // and any non-http(s) scheme that could otherwise be rendered.
  coverImage: z
    .string()
    .max(255)
    .optional()
    .refine((v) => isSafeUrl(v ?? null), 'coverImage має небезпечну схему'),
  categoryId: z.number().int().positive().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  seoTitle: z.string().max(160).optional(),
  seoDescription: z.string().max(320).optional(),
  // EN translations — optional; empty string clears the translation.
  titleEn: z.string().max(200).optional(),
  excerptEn: z.string().max(500).optional(),
  contentEn: z.string().optional(),
  seoTitleEn: z.string().max(160).optional(),
  seoDescriptionEn: z.string().max(320).optional(),
  isPublished: z.boolean().optional(),
});

export const updateBlogPostSchema = createBlogPostSchema.partial();

export const createBlogCategorySchema = z.object({
  name: z
    .string()
    .min(2, 'Назва категорії має містити щонайменше 2 символи')
    .max(100, 'Назва категорії не може перевищувати 100 символів'),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug може містити лише малі літери, цифри та дефіс')
    .max(100)
    .optional(),
  description: z.string().max(2000).optional(),
  seoTitle: z.string().max(160).optional(),
  seoDescription: z.string().max(320).optional(),
  // EN translations.
  nameEn: z.string().max(100).optional(),
  descriptionEn: z.string().max(2000).optional(),
  seoTitleEn: z.string().max(160).optional(),
  seoDescriptionEn: z.string().max(320).optional(),
});

export const updateBlogCategorySchema = createBlogCategorySchema.partial();
