import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

// Same enum + range as the POST handler. Updates were previously a free-form
// pass-through — admin could rewrite ruleType to anything and value to
// negatives, breaking checkout calculations.
const updateRuleSchema = z.object({
  ruleType: z.enum(['min_order_amount', 'min_quantity', 'multiplicity']).optional(),
  productId: z.number().int().positive().nullable().optional(),
  value: z.coerce.number().min(0).max(99_999_999.99).optional(),
  isActive: z.boolean().optional(),
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
    const parsed = updateRuleSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const updates = parsed.data;
    const data: Record<string, unknown> = {};
    if (updates.ruleType !== undefined) data.ruleType = updates.ruleType;
    if (updates.productId !== undefined) data.productId = updates.productId ?? null;
    if (updates.value !== undefined) data.value = updates.value;
    if (updates.isActive !== undefined) data.isActive = updates.isActive;

    // Capture BEFORE state for audit diff — without it the audit shows
    // "rule X was updated" but reviewer can't see what actually changed.
    const before = await prisma.wholesaleRule.findUnique({
      where: { id: numId },
      select: { ruleType: true, productId: true, value: true, isActive: true },
    });
    if (!before) return errorResponse('Правило не знайдено', 404);

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
      details: {
        action: 'update',
        before: {
          ruleType: before.ruleType,
          productId: before.productId,
          value: Number(before.value),
          isActive: before.isActive,
        },
        after: {
          ruleType: rule.ruleType,
          productId: rule.productId,
          value: Number(rule.value),
          isActive: rule.isActive,
        },
      },
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
});

export const DELETE = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params, user }) => {
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
});
