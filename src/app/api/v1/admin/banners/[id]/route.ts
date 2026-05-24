import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';
import { isSafeUrl } from '@/utils/safe-url';

const bannerUpdateSchema = z.object({
  title: z.string().max(200).nullish(),
  subtitle: z.string().max(500).nullish(),
  imageDesktop: z.string().max(500).optional(),
  imageMobile: z.string().max(500).nullish(),
  buttonLink: z
    .string()
    .max(500)
    .nullish()
    .refine((v) => isSafeUrl(v ?? null), 'buttonLink має небезпечну схему'),
  buttonText: z.string().max(100).nullish(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  variantGroup: z.string().max(50).nullish(),
  variantWeight: z.number().int().min(1).max(100).optional(),
});

export const PUT = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const parsed = bannerUpdateSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);
    const data = parsed.data;

    try {
      const banner = await prisma.banner.update({
        where: { id: numId },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.subtitle !== undefined && { subtitle: data.subtitle }),
          ...(data.imageDesktop !== undefined && { imageDesktop: data.imageDesktop }),
          ...(data.imageMobile !== undefined && { imageMobile: data.imageMobile }),
          ...(data.buttonLink !== undefined && { buttonLink: data.buttonLink }),
          ...(data.buttonText !== undefined && { buttonText: data.buttonText }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
          ...(data.variantGroup !== undefined && { variantGroup: data.variantGroup }),
          ...(data.variantWeight !== undefined && { variantWeight: data.variantWeight }),
        },
      });
      await logAudit({
        userId: user.id,
        actionType: 'data_update',
        entityType: 'banner',
        entityId: numId,
        details: { fields: Object.keys(data) },
        ipAddress: getClientIp(request),
      });
      // Storefront homepage hero is the only consumer of banner edits.
      try {
        revalidatePath('/');
      } catch {
        /* best-effort */
      }
      return successResponse(banner);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2025'
      ) {
        return errorResponse('Банер не знайдено', 404);
      }
      throw err;
    }
  } catch (err) {
    logger.error('[admin/banners/[id]] PUT failed', { error: err });
    return errorResponse('Помилка оновлення банера', 500);
  }
});

export const DELETE = withRole('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    try {
      await prisma.banner.delete({ where: { id: numId } });
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2025'
      ) {
        return errorResponse('Банер не знайдено', 404);
      }
      throw err;
    }
    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'banner',
      entityId: numId,
      ipAddress: getClientIp(request),
    });
    try {
      revalidatePath('/');
    } catch {
      /* best-effort */
    }
    return successResponse({ deleted: true });
  } catch (err) {
    logger.error('[admin/banners/[id]] DELETE failed', { error: err });
    return errorResponse('Помилка видалення банера', 500);
  }
});
