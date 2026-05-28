import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { updateSubscriptionSchema } from '@/validators/subscription';
import {
  getSubscriptionById,
  updateSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  SubscriptionError,
} from '@/services/subscription';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { successResponse, errorResponse } from '@/utils/api-response';

function parsePositiveInt(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && Number.isInteger(n) ? n : null;
}

export const GET = withAuth(async (_request: NextRequest, { user, params }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.api);
    if (!rl.allowed) return errorResponse('Забагато запитів', 429);

    const { id } = await params!;
    const numId = parsePositiveInt(id);
    if (numId === null) return errorResponse('Невалідний ID', 400);

    const subscription = await getSubscriptionById(numId, user.id);
    return successResponse(subscription);
  } catch (error) {
    if (error instanceof SubscriptionError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const PATCH = withAuth(async (request: NextRequest, { user, params }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.subscriptions);
    if (!rl.allowed) return errorResponse('Забагато запитів', 429);

    const { id } = await params!;
    const numId = parsePositiveInt(id);
    if (numId === null) return errorResponse('Невалідний ID', 400);

    const body = await request.json();
    const parsed = updateSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const ipAddress = getClientIp(request);
    let subscription;
    let auditAction = 'update';
    if (parsed.data.status === 'paused') {
      subscription = await pauseSubscription(numId, user.id);
      auditAction = 'pause';
    } else if (parsed.data.status === 'active') {
      subscription = await resumeSubscription(numId, user.id);
      auditAction = 'resume';
    } else {
      subscription = await updateSubscription(numId, user.id, parsed.data);
    }

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'subscription',
      entityId: numId,
      details: { action: auditAction },
      ipAddress,
    });

    return successResponse(subscription);
  } catch (error) {
    if (error instanceof SubscriptionError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const DELETE = withAuth(async (request: NextRequest, { user, params }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.subscriptions);
    if (!rl.allowed) return errorResponse('Забагато запитів', 429);

    const { id } = await params!;
    const numId = parsePositiveInt(id);
    if (numId === null) return errorResponse('Невалідний ID', 400);

    const subscription = await cancelSubscription(numId, user.id);

    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'subscription',
      entityId: numId,
      details: { action: 'cancel' },
      ipAddress: getClientIp(request),
    });

    return successResponse(subscription);
  } catch (error) {
    if (error instanceof SubscriptionError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
