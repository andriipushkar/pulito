import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { resolveBulkOrder } from '@/services/b2b';
import { generateCommercialProposal } from '@/services/commercial-proposal';
import { successResponse, errorResponse } from '@/utils/api-response';
import { z } from 'zod';

const proposalSchema = z.object({
  items: z.array(z.object({
    code: z.string().min(1),
    quantity: z.number().int().positive(),
  })).min(1),
  comment: z.string().max(500).optional(),
  validDays: z.number().int().min(1).max(90).optional(),
});

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = proposalSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse('Невірні дані', 400);
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { fullName: true, companyName: true, wholesaleGroup: true, role: true },
    });

    if (!userData || (userData.role !== 'wholesaler' && userData.role !== 'admin' && userData.role !== 'manager')) {
      return errorResponse('Доступно тільки для оптових покупців', 403);
    }

    const resolved = await resolveBulkOrder(parsed.data.items, userData.wholesaleGroup);

    if (resolved.items.length === 0) {
      return errorResponse('Жоден товар не знайдено', 404);
    }

    const url = await generateCommercialProposal({
      clientName: userData.fullName,
      clientCompany: userData.companyName || undefined,
      items: resolved.items.map((i) => ({
        code: i.code,
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        total: i.total,
      })),
      totalAmount: resolved.totalAmount,
      validDays: parsed.data.validDays,
      comment: parsed.data.comment,
    });

    return successResponse({ url, totalAmount: resolved.totalAmount, itemsCount: resolved.items.length });
  } catch {
    return errorResponse('Помилка генерації пропозиції', 500);
  }
});
