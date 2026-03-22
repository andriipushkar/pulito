import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { paginatedResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
    const status = searchParams.get('status') || undefined;
    const skip = (page - 1) * limit;

    const where = status ? { status: status as 'active' | 'paused' | 'cancelled' } : {};

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, fullName: true, email: true, phone: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, code: true, priceRetail: true, imagePath: true },
              },
            },
          },
        },
      }),
      prisma.subscription.count({ where }),
    ]);

    return paginatedResponse(subscriptions, total, page, limit);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
