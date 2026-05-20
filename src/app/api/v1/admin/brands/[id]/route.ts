import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { updateBrandSchema } from '@/validators/brand';
import { getBrandById, updateBrand, deleteBrand, BrandError } from '@/services/brand';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

export const GET = withRole(
  'manager',
  'admin',
)(async (_req: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const brand = await getBrandById(numId);
    if (!brand) return errorResponse('Виробника не знайдено', 404);
    return successResponse(brand);
  } catch (err) {
    logger.error('[admin/brands/[id]] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const PUT = withRole(
  'manager',
  'admin',
)(async (req: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await req.json();
    const parsed = updateBrandSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const brand = await updateBrand(numId, parsed.data);
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'brand',
      entityId: numId,
      details: parsed.data,
      ipAddress: getClientIp(req),
    });
    return successResponse(brand);
  } catch (error) {
    if (error instanceof BrandError) return errorResponse(error.message, error.statusCode);
    logger.error('[admin/brands/[id]] PUT failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const DELETE = withRole(
  'manager',
  'admin',
)(async (req: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const result = await deleteBrand(numId);
    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'brand',
      entityId: numId,
      details: { hard: result.hard },
      ipAddress: getClientIp(req),
    });
    return successResponse({
      hard: result.hard,
      message: result.hard ? 'Виробника видалено' : 'Виробника позначено як видалений',
    });
  } catch (error) {
    if (error instanceof BrandError) return errorResponse(error.message, error.statusCode);
    logger.error('[admin/brands/[id]] DELETE failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
