import { NextRequest } from 'next/server';
import { cleanupAuditLog } from '@/services/jobs/cleanup-audit-log';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    // Prefer dedicated CRON_SECRET; fall back to APP_SECRET for backwards
    // compat. APP_SECRET doubles as encryption-key salt — rotating it
    // invalidates stored ciphertext, so cron creds need their own surface.
    const cronSecret = env.CRON_SECRET || env.APP_SECRET;
    const expectedToken = `Bearer ${cronSecret}`;

    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    const result = await cleanupAuditLog();
    return successResponse(result);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
