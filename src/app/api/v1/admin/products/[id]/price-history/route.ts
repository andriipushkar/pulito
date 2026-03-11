import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole('admin', 'manager')(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const history = await prisma.priceHistory.findMany({
      where: { productId: numId },
      orderBy: { changedAt: 'desc' },
      take: 50,
    });

    return successResponse(history);
  } catch (error) {
    console.error('[Product Price History]', error);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
