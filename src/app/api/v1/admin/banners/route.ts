import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { isSafeUrl } from '@/utils/safe-url';

const bannerSchema = z.object({
  title: z.string().max(200).nullish(),
  subtitle: z.string().max(500).nullish(),
  imageDesktop: z.string().min(1, 'imageDesktop обов’язковий').max(500),
  imageMobile: z.string().max(500).nullish(),
  buttonText: z.string().max(100).nullish(),
  buttonLink: z
    .string()
    .max(500)
    .nullish()
    .refine((v) => isSafeUrl(v ?? null), 'buttonLink має небезпечну схему'),
  isActive: z.boolean().optional(),
  variantGroup: z.string().max(50).nullish(),
  variantWeight: z.number().int().min(1).max(100).optional(),
});

export const GET = withRole('admin', 'manager')(async () => {
  try {
    const banners = await prisma.banner.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return successResponse(banners);
  } catch (err) {
    logger.error('[admin/banners] GET failed', { error: err });
    return errorResponse('Помилка завантаження банерів', 500);
  }
});

export const POST = withRole('admin', 'manager')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = bannerSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);
    const data = parsed.data;

    const maxOrder = await prisma.banner.aggregate({ _max: { sortOrder: true } });

    const banner = await prisma.banner.create({
      data: {
        title: data.title ?? null,
        subtitle: data.subtitle ?? null,
        imageDesktop: data.imageDesktop,
        imageMobile: data.imageMobile ?? null,
        buttonLink: data.buttonLink ?? null,
        buttonText: data.buttonText ?? null,
        isActive: data.isActive ?? true,
        variantGroup: data.variantGroup ?? null,
        variantWeight: data.variantWeight ?? 1,
        sortOrder: (maxOrder._max.sortOrder || 0) + 1,
        createdBy: user.id,
      },
    });
    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'banner',
      entityId: banner.id,
      details: { title: banner.title, variantGroup: banner.variantGroup },
    });
    return successResponse(banner, 201);
  } catch (err) {
    logger.error('[admin/banners] POST failed', { error: err });
    return errorResponse('Помилка створення банера', 500);
  }
});
