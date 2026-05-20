import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

const ALLOWED_BADGE_TYPES = ['promo', 'new_arrival', 'hit', 'eco', 'custom'] as const;
type BadgeType = (typeof ALLOWED_BADGE_TYPES)[number];

export const GET = withRole('admin', 'manager')(
  async () => {
    try {
      const badges = await prisma.productBadge.findMany({
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
  }
);

export const POST = withRole('admin', 'manager')(
  async (request: NextRequest, { user }) => {
    try {
      const body = await request.json();

      const productId = Number(body.productId);
      if (!productId || Number.isNaN(productId)) {
        return errorResponse('productId обов\'язковий', 400);
      }
      if (!ALLOWED_BADGE_TYPES.includes(body.badgeType as BadgeType)) {
        return errorResponse('Недопустимий тип бейджа', 400);
      }
      // priority can be 0 or higher; reject NaN explicitly so a non-numeric
      // string doesn't silently get coerced to 0.
      const priorityRaw = body.priority;
      const priority = priorityRaw == null ? 0 : Number(priorityRaw);
      if (!Number.isFinite(priority) || priority < 0 || priority > 1000) {
        return errorResponse('priority має бути цілим від 0 до 1000', 400);
      }

      const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
      if (!product) return errorResponse('Товар не знайдено', 404);

      const existing = await prisma.productBadge.findUnique({
        where: { productId_badgeType: { productId, badgeType: body.badgeType } },
      });
      if (existing) {
        return errorResponse('Цей бейдж уже додано до товару', 409);
      }

      const badge = await prisma.productBadge.create({
        data: {
          productId,
          badgeType: body.badgeType,
          customText: body.customText || null,
          customColor: body.customColor || null,
          priority: Math.floor(priority),
          isActive: body.isActive ?? true,
          isLocked: body.isLocked ?? true, // manually-created badges are locked by default
        },
      });
      await logAudit({
        userId: user.id,
        actionType: 'data_create',
        entityType: 'product_badge',
        entityId: badge.id,
        details: { productId, badgeType: body.badgeType },
      });
      return successResponse(badge, 201);
    } catch (err) {
      logger.error('[admin/badges] POST failed', { error: err });
      return errorResponse('Помилка створення бейджа', 500);
    }
  }
);
