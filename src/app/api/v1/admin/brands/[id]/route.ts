import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { updateBrandSchema } from '@/validators/brand';
import { getBrandById, updateBrand, deleteBrand, BrandError } from '@/services/brand';
import { successResponse, errorResponse } from '@/utils/api-response';

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
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const PUT = withRole(
  'manager',
  'admin',
)(async (req: NextRequest, { params }) => {
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
    return successResponse(brand);
  } catch (error) {
    if (error instanceof BrandError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const DELETE = withRole(
  'manager',
  'admin',
)(async (_req: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const result = await deleteBrand(numId);
    return successResponse({
      hard: result.hard,
      message: result.hard ? 'Виробника видалено' : 'Виробника позначено як видалений',
    });
  } catch (error) {
    if (error instanceof BrandError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
