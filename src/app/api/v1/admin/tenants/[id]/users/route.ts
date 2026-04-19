import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getTenantUsers, addUserToTenant } from '@/services/tenant';
import { addTenantUserSchema } from '@/validators/tenant';

export const GET = withRole('admin')(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const users = await getTenantUsers(numId);
    return successResponse(users);
  } catch {
    return errorResponse('Помилка завантаження користувачів тенанта', 500);
  }
});

export const POST = withRole('admin')(async (request: NextRequest, { params }) => {
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
    return successResponse(tenantUser, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Помилка додавання користувача';
    if (message.includes('Unique constraint')) {
      return errorResponse('Користувач вже є учасником цього тенанта', 409);
    }
    return errorResponse(message, 500);
  }
});
