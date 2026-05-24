import { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { encrypt } from '@/lib/encryption';

export const GET = withRole('admin')(async () => {
  try {
    const subscriptions = await prisma.webhookSubscription.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { statusCode: true, createdAt: true, error: true },
        },
      },
    });
    return successResponse(subscriptions);
  } catch (error) {
    console.error('[Webhooks GET]', error);
    return errorResponse('Помилка', 500);
  }
});

export const POST = withRole('admin')(async (request: NextRequest) => {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    const events = Array.isArray(body.events)
      ? body.events.filter((e): e is string => typeof e === 'string')
      : [];
    if (!name || !url) return errorResponse("Назва і URL обов'язкові", 400);
    try {
      const parsed = new URL(url);
      const isHttps = parsed.protocol === 'https:';
      const isLocalDev =
        parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
      if (!isHttps && !isLocalDev) {
        return errorResponse(
          'URL має використовувати https:// (http:// дозволено лише для localhost)',
          400,
        );
      }
    } catch {
      return errorResponse('Невалідний URL', 400);
    }
    // Generate a fresh secret per subscription and encrypt at rest. The
    // dispatcher decrypts before HMAC-signing each delivery. We return the
    // plaintext only once (now) so the admin can copy it to the receiver.
    const plainSecret = randomBytes(32).toString('hex');
    const created = await prisma.webhookSubscription.create({
      data: {
        name,
        url,
        events,
        secret: encrypt(plainSecret),
        isActive: body.isActive !== false,
      },
    });
    return successResponse({ ...created, secret: plainSecret }, 201);
  } catch (error) {
    console.error('[Webhooks POST]', error);
    return errorResponse('Помилка створення', 500);
  }
});
