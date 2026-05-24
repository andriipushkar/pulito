import { withAuth } from '@/middleware/auth';
import { getLoginHistory } from '@/services/auth';
import { privateResponse, errorResponse } from '@/utils/api-response';

export const GET = withAuth(async (_request, { user }) => {
  try {
    const history = await getLoginHistory(user.id);
    return privateResponse(history);
  } catch {
    return errorResponse('Помилка завантаження історії', 500);
  }
});
