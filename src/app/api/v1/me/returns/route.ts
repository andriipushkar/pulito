import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { createReturnRequest, getUserReturns, ReturnError } from '@/services/return-request';
import { createReturnSchema } from '@/validators/return-request';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    const url = new URL(request.url);
    // Clamp pagination so NaN doesn't reach Prisma `skip`/`take`.
    const pageRaw = Number(url.searchParams.get('page'));
    const limitRaw = Number(url.searchParams.get('limit'));
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(50, Math.floor(limitRaw)) : 10;

    const { returns, total } = await getUserReturns(user.id, page, limit);
    const res = successResponse({ returns, total, page, limit });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch {
    return errorResponse('Помилка сервера', 500);
  }
});

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    // Return requests can be a fraud vector — cap submissions per user
    // so a stuck button (or scripted client claiming many fake returns)
    // can't auto-spam manager queue. `sensitive` = 3 per 15 min.
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.sensitive);
    if (!rl.allowed) {
      return errorResponse('Забагато заявок. Спробуйте через 15 хв.', 429);
    }

    const body = await request.json();
    const parsed = createReturnSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const returnReq = await createReturnRequest({ ...parsed.data, userId: user.id });

    // Return-fraud forensics: who submitted what, when, from which IP.
    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'return_request',
      entityId: returnReq.id,
      ipAddress: getClientIp(request),
    });

    return successResponse(returnReq, 201);
  } catch (error) {
    if (error instanceof ReturnError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Помилка сервера', 500);
  }
});
