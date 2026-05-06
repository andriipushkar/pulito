import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { GoogleBusinessError, getPlaceDetails, isConfigured } from '@/services/google-business';

export const GET = withRole(
  'admin',
  'manager',
)(async (request) => {
  try {
    const url = new URL(request.url);
    const force = url.searchParams.get('force') === '1';

    const configured = await isConfigured();
    if (!configured) {
      return successResponse({
        configured: false,
        details: null,
      });
    }

    const details = await getPlaceDetails(force);
    return successResponse({ configured: true, details });
  } catch (err) {
    if (err instanceof GoogleBusinessError) {
      return errorResponse(err.message, err.statusCode);
    }
    return errorResponse('Помилка отримання даних Google Business', 500);
  }
});
