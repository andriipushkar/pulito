import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publishNow } from '@/services/publication';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';

// Cron endpoint: publishes all scheduled publications that are due
// Should be called periodically (e.g., every minute via external cron or Vercel cron)
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;

    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    const now = new Date();
    const duePubs = await prisma.publication.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: { lte: now },
      },
      select: { id: true },
    });

    const results: { id: number; status: string }[] = [];

    for (const pub of duePubs) {
      try {
        await publishNow(pub.id);
        results.push({ id: pub.id, status: 'published' });
      } catch (err) {
        console.error(`Scheduled publish failed for ${pub.id}:`, err);
        results.push({ id: pub.id, status: 'failed' });
      }
    }

    return successResponse({ processed: results.length, results });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
