import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withRole } from '@/middleware/auth';
import { updateBundleSchema } from '@/validators/bundle';
import { updateBundle, deleteBundle, calculateBundlePrice, BundleError } from '@/services/bundle';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const GET = withRole(
  'manager',
  'admin',
)(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const bundle = await prisma.bundle.findUnique({
      where: { id: numId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                code: true,
                priceRetail: true,
                imagePath: true,
                isActive: true,
                quantity: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!bundle) return errorResponse('Комплект не знайдено', 404);

    const pricing = await calculateBundlePrice(bundle.id);

    return successResponse({ ...bundle, pricing });
  } catch (error) {
    if (error instanceof BundleError) return errorResponse(error.message, error.statusCode);
    logger.error('[admin/bundles/[id]] GET failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const PATCH = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const body = await request.json();
    const parsed = updateBundleSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const bundle = await updateBundle(numId, parsed.data);
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'bundle',
      entityId: numId,
      details: { fields: Object.keys(parsed.data) },
    });
    try {
      revalidatePath('/bundles');
      revalidatePath(`/bundles/${bundle.slug}`);
    } catch {
      /* best-effort */
    }
    return successResponse(bundle);
  } catch (error) {
    if (error instanceof BundleError) return errorResponse(error.message, error.statusCode);
    logger.error('[admin/bundles/[id]] PATCH failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const DELETE = withRole(
  'manager',
  'admin',
)(async (_request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    await deleteBundle(numId);
    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'bundle',
      entityId: numId,
    });
    try {
      revalidatePath('/bundles');
    } catch {
      /* best-effort */
    }
    return successResponse({ message: 'Комплект видалено' });
  } catch (error) {
    if (error instanceof BundleError) return errorResponse(error.message, error.statusCode);
    logger.error('[admin/bundles/[id]] DELETE failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
