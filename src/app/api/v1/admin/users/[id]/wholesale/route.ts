import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { approveWholesale, rejectWholesale, UserError } from '@/services/user';
import { successResponse, errorResponse } from '@/utils/api-response';

export const PUT = withRole('admin', 'manager')(async (request: NextRequest, { user, params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();

    if (body.action === 'approve') {
      const wholesaleGroup = body.wholesaleGroup ? Number(body.wholesaleGroup) : 1;
      const result = await approveWholesale(numId, user.id, wholesaleGroup);
      return successResponse(result);
    }

    if (body.action === 'reject') {
      const result = await rejectWholesale(numId);
      return successResponse(result);
    }

    return errorResponse('Невідома дія. Використовуйте approve або reject', 400);
  } catch (error) {
    if (error instanceof UserError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
