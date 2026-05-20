import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

export const PUT = withRole('admin', 'manager')(
  async (request: NextRequest, { params, user }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

      const body = await request.json();
      const data: Record<string, unknown> = {};

      if (body.ruleType !== undefined) data.ruleType = body.ruleType;
      if (body.productId !== undefined) data.productId = body.productId || null;
      if (body.value !== undefined) data.value = body.value;
      if (body.isActive !== undefined) data.isActive = body.isActive;

      const rule = await prisma.wholesaleRule.update({
        where: { id: numId },
        data,
        include: {
          product: { select: { id: true, name: true, code: true } },
        },
      });

      await logAudit({
        userId: user.id,
        actionType: 'rule_change',
        entityType: 'wholesale_rule',
        entityId: numId,
        details: { ...data, action: 'update' },
        ipAddress: getClientIp(request),
      });

      return successResponse({
        id: rule.id,
        ruleType: rule.ruleType,
        productId: rule.productId,
        product: rule.product,
        value: Number(rule.value),
        isActive: rule.isActive,
        createdAt: rule.createdAt,
      });
    } catch (err) {
      logger.error('[admin/wholesale-rules/[id]] PUT failed', { error: err });
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);

export const DELETE = withRole('admin', 'manager')(
  async (request: NextRequest, { params, user }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

      await prisma.wholesaleRule.delete({ where: { id: numId } });
      await logAudit({
        userId: user.id,
        actionType: 'rule_change',
        entityType: 'wholesale_rule',
        entityId: numId,
        details: { action: 'delete' },
        ipAddress: getClientIp(request),
      });
      return successResponse({ deleted: true });
    } catch (err) {
      logger.error('[admin/wholesale-rules/[id]] DELETE failed', { error: err });
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
