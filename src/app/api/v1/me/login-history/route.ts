import { withAuth } from '@/middleware/auth';
import { getLoginHistory } from '@/services/auth';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withAuth(async (_request, { user }) => {
  try {
    const history = await getLoginHistory(user.id);
    return successResponse(history);
  } catch {
    return errorResponse('Помилка завантаження історії', 500);
  }
});
