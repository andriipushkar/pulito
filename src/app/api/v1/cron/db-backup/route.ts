import { NextRequest } from 'next/server';
import { createDatabaseBackup } from '@/services/jobs/db-backup';
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

    const result = await createDatabaseBackup();
    return successResponse(result);
  } catch (err) {
    console.error('Backup failed:', err);
    return errorResponse('Помилка створення бекапу', 500);
  }
}
