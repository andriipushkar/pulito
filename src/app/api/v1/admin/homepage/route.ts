import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  getUSPItems,
  updateUSPItems,
  getSeoText,
  updateSeoText,
  getHomepageBlocks,
} from '@/services/homepage';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  const [uspItems, seoText, blocks] = await Promise.all([
    getUSPItems(),
    getSeoText(),
    getHomepageBlocks(),
  ]);

  return successResponse({ uspItems, seoText, blocks });
});

export const PATCH = withRole('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();

    if (body.uspItems !== undefined) {
      if (!Array.isArray(body.uspItems)) {
        return errorResponse('uspItems повинно бути масивом', 422);
      }
      await updateUSPItems(body.uspItems, user.id);
    }

    if (body.seoText !== undefined) {
      if (typeof body.seoText !== 'string') {
        return errorResponse('seoText повинно бути рядком', 422);
      }
      await updateSeoText(body.seoText, user.id);
    }

    return successResponse({ success: true });
  } catch {
    return errorResponse('Помилка збереження', 500);
  }
});
