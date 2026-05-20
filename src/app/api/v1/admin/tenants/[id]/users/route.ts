import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getTenantUsers, addUserToTenant } from '@/services/tenant';
import { addTenantUserSchema } from '@/validators/tenant';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const GET = withRole2fa('admin')(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const users = await getTenantUsers(numId);
    return successResponse(users);
  } catch (err) {
    logger.error('[admin/tenants/[id]/users] GET failed', { error: err });
    return errorResponse('Помилка завантаження користувачів тенанта', 500);
  }
});

export const POST = withRole2fa('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const body = await request.json();
    const parsed = addTenantUserSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const tenantUser = await addUserToTenant(
      numId,
      parsed.data.userId,
      parsed.data.role || 'member',
    );
    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'tenant_user',
      entityId: numId,
      details: { addedUserId: parsed.data.userId, role: parsed.data.role || 'member' },
    });
    return successResponse(tenantUser, 201);
  } catch (err) {
    logger.error('[admin/tenants/[id]/users] POST failed', { error: err });
    const message = err instanceof Error ? err.message : 'Помилка додавання користувача';
    if (message.includes('Unique constraint')) {
      return errorResponse('Користувач вже є учасником цього тенанта', 409);
    }
    return errorResponse(message, 500);
  }
});
