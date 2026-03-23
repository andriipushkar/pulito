import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { updateVolumeDiscount, deleteVolumeDiscount, VolumePricingError } from '@/services/volume-pricing';
import { updateVolumeDiscountSchema } from '@/validators/volume-discount';
import { successResponse, errorResponse } from '@/utils/api-response';

export const PATCH = withRole('admin')(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const body = await request.json();
    const parsed = updateVolumeDiscountSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const item = await updateVolumeDiscount(numId, parsed.data);
    return successResponse(item);
  } catch (error) {
    if (error instanceof VolumePricingError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const DELETE = withRole('admin')(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    await deleteVolumeDiscount(numId);
    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof VolumePricingError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
