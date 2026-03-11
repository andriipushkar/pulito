import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { checkBrokenLinks } from '@/services/jobs/broken-link-checker';

export const GET = withRole('admin', 'manager')(
  async () => {
    try {
      const report = await checkBrokenLinks();
      return successResponse(report);
    } catch {
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
