import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { resolveBulkOrder } from '@/services/b2b';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';
import { z } from 'zod';

const bulkOrderSchema = z.object({
  items: z
    .array(
      z.object({
        // Cap code length — product codes in this catalog are <64 chars; an
        // unbounded string lets an attacker submit 500×10MB of garbage codes.
        code: z.string().trim().min(1).max(64),
        quantity: z.number().int().positive().max(100_000),
      }),
    )
    .min(1)
    .max(500),
});

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.wholesale);
    if (!rl.allowed) return errorResponse('Забагато запитів', 429);

    const body = await request.json();
    const parsed = bulkOrderSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        parsed.error.issues[0]?.message || 'Невірні дані. Очікується масив {code, quantity}.',
        422,
      );
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { wholesaleGroup: true, role: true },
    });

    if (
      !userData ||
      (userData.role !== 'wholesaler' && userData.role !== 'admin' && userData.role !== 'manager')
    ) {
      return errorResponse('Доступно тільки для гуртових покупців', 403);
    }

    const result = await resolveBulkOrder(parsed.data.items, userData.wholesaleGroup);
    return successResponse(result);
  } catch {
    return errorResponse('Помилка обробки замовлення', 500);
  }
});
