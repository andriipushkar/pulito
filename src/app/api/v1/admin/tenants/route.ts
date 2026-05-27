import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { createTenant, getTenants } from '@/services/tenant';
import { createTenantSchema } from '@/validators/tenant';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

export const GET = withRole2fa('admin')(async (request: NextRequest) => {
  try {
    const { searchParams } = request.nextUrl;
    const filters = {
      plan: searchParams.get('plan') || undefined,
      isActive: searchParams.has('isActive') ? searchParams.get('isActive') === 'true' : undefined,
      search: searchParams.get('search') || undefined,
    };
    const tenants = await getTenants(filters);
    return successResponse(tenants);
  } catch (err) {
    logger.error('[admin/tenants] GET failed', { error: err });
    return errorResponse('Помилка завантаження тенантів', 500);
  }
});

export const POST = withRole2fa('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createTenantSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }
    const tenant = await createTenant(parsed.data);
    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'tenant',
      entityId: tenant.id,
      details: { slug: parsed.data.slug, name: parsed.data.name },
      ipAddress: getClientIp(request),
    });
    return successResponse(tenant, 201);
  } catch (err) {
    // Catch Prisma P2002 by code, not by message string — localised builds
    // change the message and the heuristic silently breaks.
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      return errorResponse('Тенант з таким slug або доменом вже існує', 409);
    }
    logger.error('[admin/tenants] POST failed', { error: err });
    return errorResponse('Помилка створення тенанта', 500);
  }
});
