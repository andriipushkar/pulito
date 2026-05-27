import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { isSafeWebhookUrl } from '@/utils/safe-url';
import { updateWebhookSchema } from '@/validators/webhook';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

// PATCH and DELETE gated by 2FA — same level as POST (creating a subscription).
// A stolen admin session must not be able to silently redirect every order/
// payment event to an attacker-controlled URL.
export const PATCH = withRole2fa('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const rawBody = await request.json();
    const parsed = updateWebhookSchema.safeParse(rawBody);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const body = parsed.data;

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.url !== undefined) {
      const url = body.url.trim();
      if (!isSafeWebhookUrl(url)) {
        return errorResponse(
          'URL має використовувати https:// і не вказувати на приватну/локальну адресу',
          400,
        );
      }
      data.url = url;
    }
    if (body.events !== undefined) data.events = body.events;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    // Snapshot before-state so audit shows URL/events changes — critical
    // forensic context if the subscription is later found pointing at an
    // attacker's endpoint.
    const before = await prisma.webhookSubscription.findUnique({
      where: { id: numId },
      select: { name: true, url: true, events: true, isActive: true },
    });
    if (!before) return errorResponse('Webhook не знайдено', 404);

    const updated = await prisma.webhookSubscription.update({ where: { id: numId }, data });

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'webhook_subscription',
      entityId: numId,
      details: { fields: Object.keys(body), before },
      ipAddress: getClientIp(request),
    });

    return successResponse(updated);
  } catch (error) {
    console.error('[Webhook PATCH]', error);
    return errorResponse('Помилка', 500);
  }
});

export const DELETE = withRole2fa('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const before = await prisma.webhookSubscription.findUnique({
      where: { id: numId },
      select: { name: true, url: true, events: true },
    });
    if (!before) return errorResponse('Webhook не знайдено', 404);

    await prisma.webhookSubscription.delete({ where: { id: numId } });

    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'webhook_subscription',
      entityId: numId,
      details: { before },
      ipAddress: getClientIp(request),
    });

    return successResponse({ ok: true });
  } catch (error) {
    console.error('[Webhook DELETE]', error);
    return errorResponse('Помилка', 500);
  }
});
