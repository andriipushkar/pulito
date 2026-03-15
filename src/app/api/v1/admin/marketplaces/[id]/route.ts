import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { updateMarketplaceListing, deleteMarketplaceListing } from '@/services/marketplaces';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';

// Update a marketplace listing
export const PUT = withRole('admin', 'manager')(
  async (request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const body = await request.json();
      const { channel, externalId, title, description, price, quantity, images } = body;

      if (!channel || !externalId) {
        return errorResponse('channel та externalId обов\'язкові', 400);
      }

      const result = await updateMarketplaceListing(channel, externalId, {
        title,
        description,
        price,
        quantity,
        images,
      }, env.APP_URL);

      if (result.status === 'published') {
        return successResponse({ updated: true, externalId });
      }
      return errorResponse(result.error || 'Помилка оновлення', 400);
    } catch {
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);

// Delete a marketplace listing
export const DELETE = withRole('admin', 'manager')(
  async (request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const { searchParams } = request.nextUrl;
      const channel = searchParams.get('channel');
      const externalId = searchParams.get('externalId');

      if (!channel || !externalId) {
        return errorResponse('channel та externalId обов\'язкові', 400);
      }

      const result = await deleteMarketplaceListing(channel, externalId);

      if (result.status === 'published') {
        return successResponse({ deleted: true });
      }
      return errorResponse(result.error || 'Помилка видалення', 400);
    } catch {
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
