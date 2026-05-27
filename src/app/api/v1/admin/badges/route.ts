import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { createBadgeSchema } from '@/validators/badge';

export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    // Optional `productId` filter so a per-product editor doesn't have to
    // fetch every badge in the system and filter client-side (N+1 in the UI).
    const { searchParams } = new URL(request.url);
    const productIdParam = searchParams.get('productId');
    const productId = productIdParam ? Number(productIdParam) : null;
    const where = productId && Number.isInteger(productId) && productId > 0 ? { productId } : {};

    const badges = await prisma.productBadge.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, code: true } },
      },
      orderBy: { priority: 'asc' },
    });
    return successResponse(badges);
  } catch (err) {
    logger.error('[admin/badges] GET failed', { error: err });
    return errorResponse('Помилка завантаження бейджів', 500);
  }
});

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createBadgeSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const data = parsed.data;

    const product = await prisma.product.findUnique({
      where: { id: data.productId },
      select: { id: true },
    });
    if (!product) return errorResponse('Товар не знайдено', 404);

    const existing = await prisma.productBadge.findUnique({
      where: { productId_badgeType: { productId: data.productId, badgeType: data.badgeType } },
    });
    if (existing) {
      return errorResponse('Цей бейдж уже додано до товару', 409);
    }

    const badge = await prisma.productBadge.create({
      data: {
        productId: data.productId,
        badgeType: data.badgeType,
        customText: data.customText ?? null,
        customColor: data.customColor ?? null,
        priority: data.priority,
        isActive: data.isActive,
        isLocked: data.isLocked,
      },
    });
    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'product_badge',
      entityId: badge.id,
      details: { productId: data.productId, badgeType: data.badgeType, isLocked: badge.isLocked },
      ipAddress: getClientIp(request),
    });
    return successResponse(badge, 201);
  } catch (err) {
    logger.error('[admin/badges] POST failed', { error: err });
    return errorResponse('Помилка створення бейджа', 500);
  }
});
