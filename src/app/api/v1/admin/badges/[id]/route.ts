import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

const ALLOWED_BADGE_TYPES = ['promo', 'new_arrival', 'hit', 'eco', 'custom'] as const;
type BadgeType = (typeof ALLOWED_BADGE_TYPES)[number];

export const PUT = withRole('admin', 'manager')(
  async (request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
      const body = await request.json();

      // Whitelist updatable fields to prevent mass-assignment (e.g. productId, createdAt).
      const data: Record<string, unknown> = {};
      if (body.badgeType !== undefined) {
        if (!ALLOWED_BADGE_TYPES.includes(body.badgeType as BadgeType)) {
          return errorResponse('Недопустимий тип бейджа', 400);
        }
        data.badgeType = body.badgeType;
      }
      if (body.customText !== undefined) data.customText = body.customText || null;
      if (body.customColor !== undefined) data.customColor = body.customColor || null;
      if (body.priority !== undefined) {
        const p = Number(body.priority);
        if (!Number.isFinite(p) || p < 0 || p > 1000) {
          return errorResponse('priority має бути цілим від 0 до 1000', 400);
        }
        data.priority = Math.floor(p);
      }
      if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
      if (body.isLocked !== undefined) data.isLocked = Boolean(body.isLocked);

      try {
        const badge = await prisma.productBadge.update({ where: { id: numId }, data });
        return successResponse(badge);
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err) {
          const code = (err as { code: string }).code;
          if (code === 'P2025') return errorResponse('Бейдж не знайдено', 404);
          if (code === 'P2002') return errorResponse('Бейдж цього типу вже існує для цього товару', 409);
        }
        throw err;
      }
    } catch (err) {
      logger.error('[admin/badges/[id]] PUT failed', { error: err });
      return errorResponse('Помилка оновлення бейджа', 500);
    }
  }
);

export const DELETE = withRole('admin', 'manager')(
  async (_request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
      try {
        await prisma.productBadge.delete({ where: { id: numId } });
        return successResponse({ deleted: true });
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
          return errorResponse('Бейдж не знайдено', 404);
        }
        throw err;
      }
    } catch (err) {
      logger.error('[admin/badges/[id]] DELETE failed', { error: err });
      return errorResponse('Помилка видалення бейджа', 500);
    }
  }
);
