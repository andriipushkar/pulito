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
const createRuleSchema = z
  .object({
    ruleType: z.enum(ruleTypes),
    productId: z.number().int().positive().nullable().optional(),
    // value is a Decimal(10,2) in DB. Allow up to 8 integer digits before the
    // decimal (max 99 999 999.99). Negatives don't make sense for any of the
    // current ruleTypes — block them.
    value: z.coerce.number().min(0).max(99_999_999.99),
    isActive: z.boolean().optional(),
    // Optional scheduling window (datetime strings; NULL = open-ended).
    validFrom: z.string().nullable().optional(),
    validUntil: z.string().nullable().optional(),
  })
  .refine((d) => !d.validFrom || !d.validUntil || new Date(d.validFrom) < new Date(d.validUntil), {
    message: 'Початок дії має бути раніше за кінець',
    path: ['validUntil'],
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
        validFrom: r.validFrom,
        validUntil: r.validUntil,
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
    const { ruleType, productId, value, isActive, validFrom, validUntil } = parsed.data;
    const newFrom = validFrom ? new Date(validFrom) : null;
    const newUntil = validUntil ? new Date(validUntil) : null;

    // Deduplicate by (ruleType, productId) — two simultaneously-active rules
    // for the same scope cause AND-logic at checkout (both must pass) instead
    // of one clear rule. With scheduling, duplicates are allowed as long as
    // their active windows DON'T overlap (e.g. a December rule + a default
    // one), so the operator can plan ahead. NULL bound = open-ended.
    const siblings = await prisma.wholesaleRule.findMany({
      where: { ruleType, productId: productId ?? null },
      select: { id: true, validFrom: true, validUntil: true },
    });
    const NEG = -Infinity;
    const POS = Infinity;
    const aFrom = newFrom ? newFrom.getTime() : NEG;
    const aUntil = newUntil ? newUntil.getTime() : POS;
    const conflict = siblings.find((s) => {
      const bFrom = s.validFrom ? s.validFrom.getTime() : NEG;
      const bUntil = s.validUntil ? s.validUntil.getTime() : POS;
      return aFrom <= bUntil && bFrom <= aUntil;
    });
    if (conflict) {
      return errorResponse(
        `Правило типу ${ruleType} для цього scope з перетином періоду вже існує (id=${conflict.id}). ` +
          `Змініть період або оновіть наявне правило.`,
        409,
      );
    }

    const rule = await prisma.wholesaleRule.create({
      data: {
        ruleType,
        productId: productId ?? null,
        value,
        isActive: isActive ?? true,
        validFrom: newFrom,
        validUntil: newUntil,
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
      validFrom: rule.validFrom,
      validUntil: rule.validUntil,
      createdAt: rule.createdAt,
    });
  } catch (err) {
    logger.error('[admin/wholesale-rules] POST failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
