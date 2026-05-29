import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

// Schema mirrors the WholesaleRuleType enum in prisma + range-clamps the
// value. Previously the route accepted arbitrary ruleType strings (Prisma
// rejected at DB layer, but the operator saw an opaque 500 instead of "the
// type must be one of …") and negative values that broke checkout math.
const ruleTypes = ['min_order_amount', 'min_quantity', 'multiplicity'] as const;
const createRuleSchema = z.object({
  ruleType: z.enum(ruleTypes),
  productId: z.number().int().positive().nullable().optional(),
  // value is a Decimal(10,2) in DB. Allow up to 8 integer digits before the
  // decimal (max 99 999 999.99). Negatives don't make sense for any of the
  // current ruleTypes — block them.
  value: z.coerce.number().min(0).max(99_999_999.99),
  isActive: z.boolean().optional(),
});

export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  try {
    const rules = await prisma.wholesaleRule.findMany({
      include: {
        product: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(
      rules.map((r) => ({
        id: r.id,
        ruleType: r.ruleType,
        productId: r.productId,
        product: r.product,
        value: Number(r.value),
        isActive: r.isActive,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    );
  } catch (err) {
    logger.error('[admin/wholesale-rules] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createRuleSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const { ruleType, productId, value, isActive } = parsed.data;

    // Deduplicate by (ruleType, productId) — two `min_order_amount`
    // GLOBAL rules cause AND-logic at checkout (both must pass) instead of
    // the obviously-intended "take the higher one". Refuse a duplicate at
    // create time so the admin updates the existing rule instead.
    const dup = await prisma.wholesaleRule.findFirst({
      where: { ruleType, productId: productId ?? null },
      select: { id: true },
    });
    if (dup) {
      return errorResponse(
        `Правило типу ${ruleType} для цього scope вже існує (id=${dup.id}). Оновіть існуюче замість створення дубліката.`,
        409,
      );
    }

    const rule = await prisma.wholesaleRule.create({
      data: {
        ruleType,
        productId: productId ?? null,
        value,
        isActive: isActive ?? true,
      },
      include: {
        product: { select: { id: true, name: true, code: true } },
      },
    });

    await logAudit({
      userId: user.id,
      actionType: 'rule_change',
      entityType: 'wholesale_rule',
      entityId: rule.id,
      details: { ruleType, productId: rule.productId, value: Number(rule.value), action: 'create' },
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
    logger.error('[admin/wholesale-rules] POST failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
