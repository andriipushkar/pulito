import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { createTenant, getTenants } from '@/services/tenant';
import { createTenantSchema } from '@/validators/tenant';
import { logger } from '@/lib/logger';

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

export const POST = withRole2fa('admin')(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = createTenantSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }
    const tenant = await createTenant(parsed.data);
    return successResponse(tenant, 201);
  } catch (err) {
    logger.error('[admin/tenants] POST failed', { error: err });
    const message = err instanceof Error ? err.message : 'Помилка створення тенанта';
    if (message.includes('Unique constraint')) {
      return errorResponse('Тенант з таким slug або доменом вже існує', 409);
    }
    return errorResponse(message, 500);
  }
});
