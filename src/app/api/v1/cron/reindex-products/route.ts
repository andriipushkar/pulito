import { NextRequest } from 'next/server';
import { indexAllProducts, isTypesenseAvailable } from '@/services/typesense';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;

    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    const available = await isTypesenseAvailable();
    if (!available) {
      return errorResponse('Typesense не доступний', 503);
    }

    const result = await indexAllProducts();
    return successResponse(result);
  } catch {
    return errorResponse('Помилка індексації', 500);
  }
}
