import { withAuth } from '@/middleware/auth';
import { getLoginHistory } from '@/services/auth';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { privateResponse, errorResponse } from '@/utils/api-response';

export const GET = withAuth(async (_request, { user }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.api);
    if (!rl.allowed) return errorResponse('Забагато запитів', 429);

    const history = await getLoginHistory(user.id);
    return privateResponse(history);
  } catch {
    return errorResponse('Помилка завантаження історії', 500);
  }
});
