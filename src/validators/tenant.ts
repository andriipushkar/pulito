import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z
    .string()
    .min(2, 'Назва має містити щонайменше 2 символи')
    .max(100, 'Назва не може перевищувати 100 символів'),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug може містити лише малі літери, цифри та дефіс')
    .min(2, 'Slug має містити щонайменше 2 символи')
    .max(63, 'Slug не може перевищувати 63 символи'),
  domain: z.string().max(255).optional().nullable(),
  logoUrl: z.string().max(500).optional().nullable(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Колір має бути у форматі #RRGGBB')
    .optional(),
  plan: z.enum(['free', 'basic', 'pro', 'enterprise']).optional(),
  isActive: z.boolean().optional(),
  settings: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const updateTenantSchema = createTenantSchema.partial();

export const addTenantUserSchema = z.object({
  userId: z.number().int().positive('userId має бути позитивним числом'),
  role: z.enum(['owner', 'admin', 'member']).optional(),
});
