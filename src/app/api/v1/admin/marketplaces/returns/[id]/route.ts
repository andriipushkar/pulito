import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

const VALID_STATUSES = ['pending', 'approved', 'rejected', 'completed'] as const;

export const PATCH = withRole('admin')(
  async (request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const returnId = Number(id);

      if (isNaN(returnId)) {
        return errorResponse('Невалідний ID повернення', 400);
      }

      const body = await request.json();

      if (!body.status || !VALID_STATUSES.includes(body.status)) {
        return errorResponse(`Невалідний статус. Допустимі: ${VALID_STATUSES.join(', ')}`, 400);
      }

      const existing = await prisma.marketplaceReturn.findUnique({
        where: { id: returnId },
      });

      if (!existing) {
        return errorResponse('Повернення не знайдено', 404);
      }

      const updated = await prisma.marketplaceReturn.update({
        where: { id: returnId },
        data: { status: body.status },
        include: {
          connection: { select: { platform: true } },
          order: { select: { id: true, orderNumber: true } },
        },
      });

      return successResponse(updated);
    } catch {
      return errorResponse('Помилка оновлення повернення', 500);
    }
  }
);
