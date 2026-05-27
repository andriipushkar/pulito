import { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { withRole, withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { encrypt } from '@/lib/encryption';
import { isSafeWebhookUrl } from '@/utils/safe-url';
import { getClientIp } from '@/utils/request';
import { logAudit } from '@/services/audit';

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

export const POST = withRole2fa('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    const events = Array.isArray(body.events)
      ? body.events.filter((e): e is string => typeof e === 'string')
      : [];
    if (!name || !url) return errorResponse("Назва і URL обов'язкові", 400);
    if (!isSafeWebhookUrl(url)) {
      return errorResponse(
        'URL має використовувати https:// і не вказувати на приватну/локальну адресу',
        400,
      );
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
    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'webhook_subscription',
      entityId: created.id,
      details: { name, url, events },
      ipAddress: getClientIp(request),
    });
    return successResponse({ ...created, secret: plainSecret }, 201);
  } catch (error) {
    console.error('[Webhooks POST]', error);
    return errorResponse('Помилка створення', 500);
  }
});
