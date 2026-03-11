import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getOrderById } from '@/services/order';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole('admin', 'manager')(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const order = await getOrderById(numId);
    if (!order) {
      return errorResponse('Замовлення не знайдено', 404);
    }
    return successResponse(order);
  } catch (error) {
    console.error('[Admin Order Detail]', error);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const PUT = withRole('admin', 'manager')(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};
    if ('assignedManagerId' in body) {
      data.assignedManagerId = body.assignedManagerId ? Number(body.assignedManagerId) : null;
    }

    if (Object.keys(data).length === 0) return errorResponse('Немає даних для оновлення', 400);

    await prisma.order.update({ where: { id: numId }, data });
    const order = await getOrderById(numId);
    return successResponse(order);
  } catch (error) {
    console.error('[Admin Order Update]', error);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
