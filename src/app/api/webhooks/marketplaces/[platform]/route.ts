import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getChannelConfig, type MarketplaceConfig } from '@/services/channel-config';
import { isMarketplacePlatform, type MarketplacePlatform } from '@/services/marketplace-health';
import {
  getOrCreateConnectionId,
  importOrdersFromMarketplace,
  mapReturnStatus,
} from '@/services/marketplace-sync';
import { syncMarketplaceMessages } from '@/services/marketplace-messages-sync';
import { logger } from '@/lib/logger';

// Generic webhook receiver for marketplaces. Each marketplace has a different
// payload shape and signature scheme — we route by platform and use a stored
// `webhookSecret` in the marketplace's config for HMAC verification.
//
// Webhook URLs to register on each marketplace dashboard:
//   - OLX:       <APP_URL>/api/webhooks/marketplaces/olx
//   - Rozetka:   <APP_URL>/api/webhooks/marketplaces/rozetka
//   - Prom:      <APP_URL>/api/webhooks/marketplaces/prom
//   - Epicentr:  <APP_URL>/api/webhooks/marketplaces/epicentrk

function verifySignature(
  rawBody: string,
  signature: string | null,
  secret: string,
  algorithm: 'sha1' | 'sha256' = 'sha256',
): boolean {
  if (!signature) return false;
  const computed = createHmac(algorithm, secret).update(rawBody).digest('hex');
  // Strip common prefixes like "sha256=..." — but reject signatures that
  // become empty after stripping (e.g. raw "sha256=" header), otherwise the
  // empty string would tries to compare against an empty buffer and pass.
  const incoming = signature.includes('=') ? signature.split('=').pop()! : signature;
  if (!incoming || incoming.length === 0) return false;
  // Hex sanity: reject anything that isn't hex digits before turning into a
  // Buffer (which would silently produce garbage).
  if (!/^[0-9a-fA-F]+$/.test(incoming)) return false;
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(incoming, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function extractSignature(req: NextRequest, platform: MarketplacePlatform): string | null {
  switch (platform) {
    case 'olx':
      return req.headers.get('signature') || req.headers.get('x-olx-signature');
    case 'rozetka':
      return req.headers.get('x-rozetka-sign') || req.headers.get('x-rozetka-signature');
    case 'prom':
      return req.headers.get('x-prom-signature') || req.headers.get('signature');
    case 'epicentrk':
      return req.headers.get('x-epicentr-signature') || req.headers.get('signature');
  }
}

function sigAlgo(platform: MarketplacePlatform): 'sha1' | 'sha256' {
  return platform === 'olx' ? 'sha1' : 'sha256';
}

// ── Event normalization ──

type WebhookEvent =
  | { type: 'order.created' | 'order.updated'; orderId: string; status?: string; raw: Record<string, unknown> }
  | { type: 'return.created' | 'return.updated'; returnId: string; orderId?: string; status?: string; raw: Record<string, unknown> }
  | { type: 'listing.approved' | 'listing.rejected'; externalId: string; reason?: string; raw: Record<string, unknown> }
  | { type: 'message.received'; messageId: string; raw: Record<string, unknown> }
  | { type: 'unknown'; raw: Record<string, unknown> };

function parseEvent(platform: MarketplacePlatform, body: Record<string, unknown>): WebhookEvent {
  // OLX format: { event: "new_message", data: { ... } }
  // Rozetka format: { event_type: "order_created", data: { ... } }
  // Prom format: { event: "orders.new", payload: { ... } }
  // Epicentr format: { type: "...", payload: { ... } } (assumed)
  const eventName = String(
    body.event || body.event_type || body.type || '',
  ).toLowerCase();
  const data = (body.data || body.payload || body) as Record<string, unknown>;

  if (eventName.includes('order') && (eventName.includes('creat') || eventName.includes('.new'))) {
    return { type: 'order.created', orderId: String(data.id || data.order_id || ''), status: data.status ? String(data.status) : undefined, raw: body };
  }
  if (eventName.includes('order') && (eventName.includes('status') || eventName.includes('updat'))) {
    return { type: 'order.updated', orderId: String(data.id || data.order_id || ''), status: data.status ? String(data.status) : undefined, raw: body };
  }
  if (eventName.includes('return') && eventName.includes('creat')) {
    return { type: 'return.created', returnId: String(data.id || ''), orderId: data.order_id ? String(data.order_id) : undefined, status: data.status ? String(data.status) : undefined, raw: body };
  }
  if (eventName.includes('return')) {
    return { type: 'return.updated', returnId: String(data.id || ''), orderId: data.order_id ? String(data.order_id) : undefined, status: data.status ? String(data.status) : undefined, raw: body };
  }
  if (eventName.includes('advert') && (eventName.includes('approv') || eventName.includes('status'))) {
    const status = String(data.status || '');
    const externalId = String(data.id || data.advert_id || '');
    return {
      type: status.includes('reject') ? 'listing.rejected' : 'listing.approved',
      externalId,
      reason: data.reason ? String(data.reason) : undefined,
      raw: body,
    };
  }
  if (eventName.includes('message')) {
    return { type: 'message.received', messageId: String(data.id || ''), raw: body };
  }
  return { type: 'unknown', raw: body };
}

// ── Handlers ──

async function handleOrderEvent(
  platform: MarketplacePlatform,
  event: Extract<WebhookEvent, { type: 'order.created' | 'order.updated' }>,
) {
  if (!event.orderId) return;
  const existing = await prisma.order.findFirst({
    where: { externalId: event.orderId, source: platform },
  });
  if (event.type === 'order.created' && !existing) {
    // Webhook payload doesn't include full order details (varies per
    // marketplace), so fire-and-forget a fetch of the platform's recent
    // orders. importOrdersFromMarketplace is idempotent — dedups by externalId
    // — so a concurrent cron run is harmless.
    void importOrdersFromMarketplace(platform).catch((err) => {
      logger.error('[Webhook] order.created → import failed', {
        platform,
        externalOrderId: event.orderId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
    return;
  }
  if (existing && event.status) {
    // Mirror status changes when we have them
    const statusMap: Record<string, string> = {
      cancelled: 'cancelled',
      canceled: 'cancelled',
      completed: 'completed',
      delivered: 'completed',
      shipped: 'shipped',
      paid: 'paid',
    };
    const mapped = statusMap[event.status.toLowerCase()];
    if (mapped) {
      await prisma.order.update({
        where: { id: existing.id },
        data: { status: mapped as 'cancelled' | 'completed' | 'shipped' | 'paid' },
      });
    }
  }
}

async function handleListingEvent(
  platform: MarketplacePlatform,
  event: Extract<WebhookEvent, { type: 'listing.approved' | 'listing.rejected' }>,
) {
  if (!event.externalId) return;
  await prisma.publicationChannel.updateMany({
    where: { channel: platform, externalId: event.externalId },
    data: {
      status: event.type === 'listing.approved' ? 'published' : 'failed',
      errorMessage: event.type === 'listing.rejected' ? event.reason || 'Відхилено маркетплейсом' : null,
    },
  });
}

async function handleReturnEvent(
  platform: MarketplacePlatform,
  event: Extract<WebhookEvent, { type: 'return.created' | 'return.updated' }>,
) {
  if (!event.returnId) return;

  const connectionId = await getOrCreateConnectionId(platform);
  const localOrder = event.orderId
    ? await prisma.order.findFirst({
        where: { externalId: event.orderId, source: platform },
        select: { id: true },
      })
    : null;

  const data = (event.raw.data || event.raw.payload || event.raw) as Record<string, unknown>;
  const quantity = Number(data.quantity ?? 1);
  const reason = data.reason ? String(data.reason) : null;
  const refundAmount =
    data.refund_amount != null
      ? Number(data.refund_amount)
      : data.refundAmount != null
      ? Number(data.refundAmount)
      : null;
  const mappedStatus = mapReturnStatus(event.status || 'pending');

  await prisma.marketplaceReturn.upsert({
    where: {
      connectionId_externalReturnId: {
        connectionId,
        externalReturnId: event.returnId,
      },
    },
    update: {
      status: mappedStatus,
      reason,
      quantity,
      refundAmount,
    },
    create: {
      connectionId,
      externalReturnId: event.returnId,
      orderId: localOrder?.id || null,
      status: mappedStatus,
      reason,
      quantity,
      refundAmount,
    },
  });
}

async function handleMessageEvent(
  platform: MarketplacePlatform,
  event: Extract<WebhookEvent, { type: 'message.received' }>,
) {
  if (!event.messageId) return;
  // Bump the badge marker so the menu updates without waiting for an admin poll.
  const key = `marketplace_unread_${platform}`;
  const now = new Date().toISOString();
  await prisma.siteSetting.upsert({
    where: { key },
    update: { value: now },
    create: { key, value: now },
  });
  // Fire-and-forget: pull message threads from the marketplace API so the
  // MarketplaceMessage table is up to date by the time the admin opens the tab.
  void syncMarketplaceMessages().catch((err) => {
    logger.error('[Webhook] message.received → sync failed', {
      platform,
      messageId: event.messageId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
  // Fire-and-forget: push notification to admins so they don't miss the message.
  void (async () => {
    try {
      const { sendPushToAdmins } = await import('@/services/push');
      const platformLabels: Record<string, string> = {
        olx: 'OLX', rozetka: 'Rozetka', prom: 'Prom.ua', epicentrk: 'Epicentr K',
      };
      await sendPushToAdmins({
        title: `💬 Нове повідомлення на ${platformLabels[platform] || platform}`,
        body: 'Перейдіть до вкладки «Повідомлення», щоб відповісти.',
        url: '/admin/marketplaces',
      });
    } catch (err) {
      logger.error('[Webhook] push admin notification failed', {
        platform,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
}

async function logWebhook(
  source: string,
  event: string,
  payload: Record<string, unknown> | string,
  statusCode: number,
  durationMs: number,
  error: string | null,
) {
  try {
    await prisma.webhookLog.create({
      data: {
        source,
        event,
        payload: payload as unknown as Parameters<typeof prisma.webhookLog.create>[0]['data']['payload'],
        statusCode,
        durationMs,
        error,
      },
    });
  } catch (err) {
    logger.error('[Webhook] failed to write WebhookLog', {
      source,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const startedAt = Date.now();
  const { platform: rawPlatform } = await params;
  if (!isMarketplacePlatform(rawPlatform)) {
    await logWebhook(rawPlatform, 'unknown', {}, 404, Date.now() - startedAt, 'Unknown marketplace');
    return NextResponse.json({ error: 'Unknown marketplace' }, { status: 404 });
  }
  const platform = rawPlatform as MarketplacePlatform;

  const rawBody = await req.text();
  const config = (await getChannelConfig(platform)) as MarketplaceConfig | null;

  // Signature is mandatory in production. An unconfigured webhookSecret used
  // to silently allow unsigned POSTs — easy way for an attacker to inject
  // fake "paid" events. Fail-closed in prod, allow unsigned only in dev.
  const webhookSecret = typeof config?.webhookSecret === 'string' ? config.webhookSecret : '';
  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('[Webhook] missing webhookSecret', { platform });
      await logWebhook(platform, 'no_secret', {}, 503, Date.now() - startedAt, 'Webhook secret not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 });
    }
  } else {
    const signature = extractSignature(req, platform);
    if (!verifySignature(rawBody, signature, webhookSecret, sigAlgo(platform))) {
      logger.warn('[Webhook] signature verification failed', { platform });
      await logWebhook(platform, 'signature_fail', { signature }, 401, Date.now() - startedAt, 'Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    await logWebhook(platform, 'invalid_json', rawBody.slice(0, 1000), 400, Date.now() - startedAt, 'Invalid JSON');
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = parseEvent(platform, body);

  try {
    if (event.type === 'order.created' || event.type === 'order.updated') {
      await handleOrderEvent(platform, event);
    } else if (event.type === 'listing.approved' || event.type === 'listing.rejected') {
      await handleListingEvent(platform, event);
    } else if (event.type === 'return.created' || event.type === 'return.updated') {
      await handleReturnEvent(platform, event);
    } else if (event.type === 'message.received') {
      await handleMessageEvent(platform, event);
    }

    await logWebhook(platform, event.type, body, 200, Date.now() - startedAt, null);
    return NextResponse.json({ ok: true, event: event.type });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Trim before stashing in WebhookLog so a stack trace in the catch can't
    // bloat the audit row (admins read this in the panel) or leak file paths.
    const safeMessage = message.slice(0, 500).split('\n')[0];
    logger.error('[Webhook] handler error', { platform, event: event.type, error: safeMessage });
    // Return 200 even on handler failure so the marketplace doesn't keep retrying
    // — we have the payload in WebhookLog and can replay manually if needed.
    await logWebhook(platform, event.type, body, 500, Date.now() - startedAt, safeMessage);
    return NextResponse.json({ ok: false, error: 'Handler failed', event: event.type });
  }
}
