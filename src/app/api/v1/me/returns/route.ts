import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { createReturnRequest, getUserReturns, ReturnError } from '@/services/return-request';
import { createReturnSchema } from '@/validators/return-request';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = Math.min(Number(url.searchParams.get('limit')) || 10, 50);

    const { returns, total } = await getUserReturns(user.id, page, limit);
    return successResponse({ returns, total, page, limit });
  } catch {
    return errorResponse('Помилка сервера', 500);
  }
});

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createReturnSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const returnReq = await createReturnRequest({ ...parsed.data, userId: user.id });
    return successResponse(returnReq, 201);
  } catch (error) {
    if (error instanceof ReturnError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Помилка сервера', 500);
  }
});
