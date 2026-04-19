import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getTenantById, updateTenant, deleteTenant } from '@/services/tenant';
import { updateTenantSchema } from '@/validators/tenant';

export const GET = withRole('admin')(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const tenant = await getTenantById(numId);
    if (!tenant) return errorResponse('Тенант не знайдено', 404);

    return successResponse(tenant);
  } catch {
    return errorResponse('Помилка завантаження тенанта', 500);
  }
});

export const PATCH = withRole('admin')(async (request: NextRequest, { params }) => {
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
    return successResponse(tenant);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Помилка оновлення тенанта';
    if (message.includes('Unique constraint')) {
      return errorResponse('Тенант з таким slug або доменом вже існує', 409);
    }
    return errorResponse(message, 500);
  }
});

export const DELETE = withRole('admin')(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    await deleteTenant(numId);
    return successResponse({ deleted: true });
  } catch {
    return errorResponse('Помилка видалення тенанта', 500);
  }
});
