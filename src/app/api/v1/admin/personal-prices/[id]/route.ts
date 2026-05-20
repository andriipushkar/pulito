import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { updatePersonalPrice, deletePersonalPrice, PersonalPriceError } from '@/services/personal-price';
import { updatePersonalPriceSchema } from '@/validators/personal-price';
import { successResponse, errorResponse } from '@/utils/api-response';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const GET = withRole('admin', 'manager')(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const item = await prisma.personalPrice.findUnique({
      where: { id: numId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        product: { select: { id: true, name: true, code: true } },
        creator: { select: { id: true, fullName: true } },
      },
    });

    if (!item) return errorResponse('Не знайдено', 404);
    return successResponse(item);
  } catch (err) {
    logger.error('[admin/personal-prices/[id]] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const PUT = withRole('admin', 'manager')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const parsed = updatePersonalPriceSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const item = await updatePersonalPrice(numId, parsed.data);
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'personal_price',
      entityId: numId,
      details: { fields: Object.keys(parsed.data) },
    });
    return successResponse(item);
  } catch (error) {
    if (error instanceof PersonalPriceError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/personal-prices/[id]] PUT failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const DELETE = withRole('admin', 'manager')(async (_request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    await deletePersonalPrice(numId);
    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'personal_price',
      entityId: numId,
    });
    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof PersonalPriceError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/personal-prices/[id]] DELETE failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
