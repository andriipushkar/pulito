import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  getPersonalPrices,
  createPersonalPrice,
  PersonalPriceError,
} from '@/services/personal-price';
import { personalPriceFilterSchema, createPersonalPriceSchema } from '@/validators/personal-price';
import { successResponse, errorResponse, paginatedResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = personalPriceFilterSchema.safeParse(params);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    // Managers see only their assigned customers' prices; admins see all.
    const managerScopeId = user.role === 'manager' ? user.id : null;
    const { items, total } = await getPersonalPrices(parsed.data, managerScopeId);
    return paginatedResponse(items, total, parsed.data.page, parsed.data.limit);
  } catch (err) {
    logger.error('[admin/personal-prices] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createPersonalPriceSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const managerScopeId = user.role === 'manager' ? user.id : null;
    const item = await createPersonalPrice(parsed.data, user.id, managerScopeId);
    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'personal_price',
      entityId: item.id,
    });
    return successResponse(item, 201);
  } catch (error) {
    if (error instanceof PersonalPriceError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/personal-prices] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
