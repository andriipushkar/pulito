import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { createSubscriptionSchema } from '@/validators/subscription';
import { createSubscription, getUserSubscriptions, SubscriptionError } from '@/services/subscription';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withAuth(async (_request: NextRequest, { user }) => {
  try {
    const subscriptions = await getUserSubscriptions(user.id);
    return successResponse(subscriptions);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const subscription = await createSubscription(user.id, parsed.data);
    return successResponse(subscription, 201);
  } catch (error) {
    if (error instanceof SubscriptionError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
