import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getTenantById, updateTenant, deleteTenant, TenantError } from '@/services/tenant';
import { updateTenantSchema } from '@/validators/tenant';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { prisma } from '@/lib/prisma';

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

    // Before-snapshot so audit shows the actual value changes, not just
    // which keys were touched. Plan downgrades and isActive flips are
    // policy-sensitive — visibility on the prior value matters.
    const before = await prisma.tenant.findUnique({
      where: { id: numId },
      select: { plan: true, isActive: true, domain: true, slug: true, name: true },
    });

    const tenant = await updateTenant(numId, parsed.data);
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'tenant',
      entityId: numId,
      details: { fields: Object.keys(parsed.data), before },
      ipAddress: getClientIp(request),
    });
    return successResponse(tenant);
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      return errorResponse('Тенант з таким slug або доменом вже існує', 409);
    }
    logger.error('[admin/tenants/[id]] PATCH failed', { error: err });
    return errorResponse('Помилка оновлення тенанта', 500);
  }
});

export const DELETE = withRole2fa('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const force = request.nextUrl.searchParams.get('force') === 'true';

    // Snapshot the tenant before deletion so audit has its slug/domain on
    // record. With `force=true` this is catastrophic — cascade kills users —
    // and "which tenant was forcibly removed last Friday?" is a frequent
    // forensic question.
    const before = await prisma.tenant.findUnique({
      where: { id: numId },
      select: { slug: true, name: true, domain: true, plan: true, isActive: true },
    });

    const result = await deleteTenant(numId, { force });
    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'tenant',
      entityId: numId,
      details: { force, before, userCount: result.userCount },
      ipAddress: getClientIp(request),
    });
    return successResponse(result);
  } catch (err) {
    if (err instanceof TenantError) return errorResponse(err.message, err.statusCode);
    logger.error('[admin/tenants/[id]] DELETE failed', { error: err });
    return errorResponse('Помилка видалення тенанта', 500);
  }
});
