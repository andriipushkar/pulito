import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { resolveBulkOrder } from '@/services/b2b';
import { generateCommercialProposal } from '@/services/commercial-proposal';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';
import { z } from 'zod';

const proposalSchema = z.object({
  items: z
    .array(
      z.object({
        code: z.string().trim().min(1).max(64),
        quantity: z.number().int().positive().max(100_000),
      }),
    )
    .min(1)
    .max(500),
  comment: z.string().trim().max(500).optional(),
  validDays: z.number().int().min(1).max(90).optional(),
});

// PDF generation is expensive (Chromium spawn + DB joins). Cap per-user with
// the adminPdfExport bucket (50/day) — a non-admin wholesale client looping
// the endpoint would otherwise exhaust disk space overnight.
export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.adminPdfExport);
    if (!rl.allowed) return errorResponse('Денний ліміт генерації пропозицій вичерпано', 429);

    const body = await request.json();
    const parsed = proposalSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невірні дані', 422);
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { fullName: true, companyName: true, wholesaleGroup: true, role: true },
    });

    if (
      !userData ||
      (userData.role !== 'wholesaler' && userData.role !== 'admin' && userData.role !== 'manager')
    ) {
      return errorResponse('Доступно тільки для гуртових покупців', 403);
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

    return successResponse({
      url,
      totalAmount: resolved.totalAmount,
      itemsCount: resolved.items.length,
    });
  } catch {
    return errorResponse('Помилка генерації пропозиції', 500);
  }
});
