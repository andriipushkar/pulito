import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getSeoText, updateSeoText, getHomepageBlocks } from '@/services/homepage';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  const [seoText, blocks] = await Promise.all([getSeoText(), getHomepageBlocks()]);

  return successResponse({ seoText, blocks });
});

export const PATCH = withRole('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();

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
