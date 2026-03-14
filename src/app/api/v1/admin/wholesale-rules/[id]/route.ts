import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const PUT = withRole('admin', 'manager')(
  async (request: NextRequest, { params }) => {
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
  }
);

export const DELETE = withRole('admin', 'manager')(
  async (_request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

      await prisma.wholesaleRule.delete({ where: { id: numId } });
      return successResponse({ deleted: true });
    } catch {
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
