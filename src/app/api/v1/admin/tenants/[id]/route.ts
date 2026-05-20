import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getTenantById, updateTenant, deleteTenant, TenantError } from '@/services/tenant';
import { updateTenantSchema } from '@/validators/tenant';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const GET = withRole2fa('admin')(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const tenant = await getTenantById(numId);
    if (!tenant) return errorResponse('Тенант не знайдено', 404);

    return successResponse(tenant);
  } catch (err) {
    logger.error('[admin/tenants/[id]] GET failed', { error: err });
    return errorResponse('Помилка завантаження тенанта', 500);
  }
});

export const PATCH = withRole2fa('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const body = await request.json();
    const parsed = updateTenantSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const tenant = await updateTenant(numId, parsed.data);
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'tenant',
      entityId: numId,
      details: { fields: Object.keys(parsed.data) },
    });
    return successResponse(tenant);
  } catch (err) {
    logger.error('[admin/tenants/[id]] PATCH failed', { error: err });
    const message = err instanceof Error ? err.message : 'Помилка оновлення тенанта';
    if (message.includes('Unique constraint')) {
      return errorResponse('Тенант з таким slug або доменом вже існує', 409);
    }
    return errorResponse(message, 500);
  }
});

export const DELETE = withRole2fa('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const force = request.nextUrl.searchParams.get('force') === 'true';
    const result = await deleteTenant(numId, { force });
    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'tenant',
      entityId: numId,
      details: { force },
    });
    return successResponse(result);
  } catch (err) {
    if (err instanceof TenantError) return errorResponse(err.message, err.statusCode);
    logger.error('[admin/tenants/[id]] DELETE failed', { error: err });
    return errorResponse('Помилка видалення тенанта', 500);
  }
});
