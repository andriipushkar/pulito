import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { createBrandSchema } from '@/validators/brand';
import { getBrands, createBrand, BrandError } from '@/services/brand';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole(
  'manager',
  'admin',
)(async (request: NextRequest) => {
  try {
    const includeHidden = request.nextUrl.searchParams.get('includeHidden') === 'true';
    const brands = await getBrands({ includeHidden: includeHidden || true });
    return successResponse(brands);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = createBrandSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const brand = await createBrand(parsed.data);
    return successResponse(brand, 201);
  } catch (error) {
    if (error instanceof BrandError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
