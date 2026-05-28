import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { getUnreadCount } from '@/services/notification';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { errorResponse } from '@/utils/api-response';

export const GET = withAuth(async (_request: NextRequest, { user }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.api);
    if (!rl.allowed) return errorResponse('Забагато запитів', 429);

    const count = await getUnreadCount(user.id);
    // Short private cache — header poll fires every 30-60s, this keeps
    // repeated polls from the same user off the DB without serving stale
    // counts longer than that natural cadence.
    return NextResponse.json(
      { success: true, data: { count } },
      { headers: { 'Cache-Control': 'private, max-age=30, must-revalidate' } },
    );
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
