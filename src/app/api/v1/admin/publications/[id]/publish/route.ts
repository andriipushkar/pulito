import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { publishNow, PublicationError } from '@/services/publication';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const POST = withRole('admin', 'manager')(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    // Mark as publishing immediately
    await prisma.publication.update({
      where: { id: numId },
      data: { status: 'scheduled' },
    });

    // Start publishing in the background (don't await)
    publishNow(numId).catch((err) => {
      console.error(`Background publish failed for ${numId}:`, err);
    });

    return successResponse({ id: numId, status: 'publishing' });
  } catch (error) {
    if (error instanceof PublicationError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
