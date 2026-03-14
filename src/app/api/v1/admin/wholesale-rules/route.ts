import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole('admin', 'manager')(async () => {
  try {
    const rules = await prisma.wholesaleRule.findMany({
      include: {
        product: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(rules.map((r) => ({
      id: r.id,
      ruleType: r.ruleType,
      productId: r.productId,
      product: r.product,
      value: Number(r.value),
      isActive: r.isActive,
      createdAt: r.createdAt,
    })));
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { ruleType, productId, value, isActive } = body;

    if (!ruleType || value === undefined || value === null) {
      return errorResponse('ruleType та value обов\'язкові', 422);
    }

    const rule = await prisma.wholesaleRule.create({
      data: {
        ruleType,
        productId: productId || null,
        value,
        isActive: isActive ?? true,
      },
      include: {
        product: { select: { id: true, name: true, code: true } },
      },
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
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
