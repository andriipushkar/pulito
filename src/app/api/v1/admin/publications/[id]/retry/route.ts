import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { retryChannel, PublicationError } from '@/services/publication';
import { successResponse, errorResponse } from '@/utils/api-response';

export const POST = withRole('admin', 'manager')(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const { channel } = await request.json();
    if (!channel) return errorResponse('Канал не вказано', 400);

    const pub = await retryChannel(numId, channel);
    return successResponse(pub);
  } catch (error) {
    if (error instanceof PublicationError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
