import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { resolveBulkOrder } from '@/services/b2b';
import { successResponse, errorResponse } from '@/utils/api-response';
import { z } from 'zod';

const bulkOrderSchema = z.object({
  items: z.array(z.object({
    code: z.string().min(1),
    quantity: z.number().int().positive(),
  })).min(1).max(500),
});

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = bulkOrderSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse('Невірні дані. Очікується масив {code, quantity}.', 400);
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { wholesaleGroup: true, role: true },
    });

    if (!userData || (userData.role !== 'wholesaler' && userData.role !== 'admin' && userData.role !== 'manager')) {
      return errorResponse('Доступно тільки для оптових покупців', 403);
    }

    const result = await resolveBulkOrder(parsed.data.items, userData.wholesaleGroup);
    return successResponse(result);
  } catch {
    return errorResponse('Помилка обробки замовлення', 500);
  }
});
