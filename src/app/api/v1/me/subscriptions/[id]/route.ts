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
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withAuth(async (_request: NextRequest, { user, params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const subscription = await getSubscriptionById(numId, user.id);
    return successResponse(subscription);
  } catch (error) {
    if (error instanceof SubscriptionError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const PATCH = withAuth(async (request: NextRequest, { user, params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const body = await request.json();
    const parsed = updateSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    // Handle status changes via dedicated service methods
    if (parsed.data.status === 'paused') {
      const subscription = await pauseSubscription(numId, user.id);
      return successResponse(subscription);
    }
    if (parsed.data.status === 'active') {
      const subscription = await resumeSubscription(numId, user.id);
      return successResponse(subscription);
    }

    const subscription = await updateSubscription(numId, user.id, parsed.data);
    return successResponse(subscription);
  } catch (error) {
    if (error instanceof SubscriptionError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const DELETE = withAuth(async (_request: NextRequest, { user, params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const subscription = await cancelSubscription(numId, user.id);
    return successResponse(subscription);
  } catch (error) {
    if (error instanceof SubscriptionError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
