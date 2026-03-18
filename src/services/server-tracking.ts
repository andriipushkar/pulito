import { createHash } from 'crypto';
import { env } from '@/config/env';

/**
 * Server-side event tracking for Facebook Conversion API and GA4 Measurement Protocol.
 * Bypasses ad blockers by sending events directly from the server.
 */

interface TrackingEvent {
  eventName: string;
  userId?: number;
  email?: string;
  phone?: string;
  ipAddress?: string;
  userAgent?: string;
  value?: number;
  currency?: string;
  orderId?: string;
  items?: { id: string; name: string; price: number; quantity: number }[];
}

// ── Facebook Conversion API ──

export async function trackFacebookEvent(event: TrackingEvent): Promise<void> {
  const pixelId = process.env.FACEBOOK_PIXEL_ID;
  const accessToken = process.env.FACEBOOK_CAPI_TOKEN;
  if (!pixelId || !accessToken) return;

  try {
    const hashedEmail = event.email ? createHash('sha256').update(event.email.toLowerCase().trim()).digest('hex') : undefined;
    const hashedPhone = event.phone ? createHash('sha256').update(event.phone.replace(/\D/g, '')).digest('hex') : undefined;

    const fbEvent = {
      event_name: event.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: `${env.APP_URL}/checkout`,
      action_source: 'website',
      user_data: {
        ...(hashedEmail && { em: [hashedEmail] }),
        ...(hashedPhone && { ph: [hashedPhone] }),
        ...(event.ipAddress && { client_ip_address: event.ipAddress }),
        ...(event.userAgent && { client_user_agent: event.userAgent }),
        ...(event.userId && { external_id: [createHash('sha256').update(String(event.userId)).digest('hex')] }),
      },
      custom_data: {
        ...(event.value && { value: event.value, currency: event.currency || 'UAH' }),
        ...(event.orderId && { order_id: event.orderId }),
        ...(event.items && {
          contents: event.items.map((i) => ({
            id: i.id,
            quantity: i.quantity,
            item_price: i.price,
          })),
          content_type: 'product',
          num_items: event.items.reduce((sum, i) => sum + i.quantity, 0),
        }),
      },
    };

    await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [fbEvent],
        access_token: accessToken,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Non-blocking — don't fail the order
  }
}

// ── Google Analytics 4 Measurement Protocol ──

export async function trackGA4Event(event: TrackingEvent): Promise<void> {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return;

  try {
    const clientId = event.userId ? String(event.userId) : 'server';

    const ga4Event: Record<string, unknown> = {
      name: event.eventName,
      params: {
        ...(event.value && { value: event.value, currency: event.currency || 'UAH' }),
        ...(event.orderId && { transaction_id: event.orderId }),
        ...(event.items && {
          items: event.items.map((i) => ({
            item_id: i.id,
            item_name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
        }),
      },
    };

    await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        ...(event.userId && { user_id: String(event.userId) }),
        events: [ga4Event],
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Non-blocking
  }
}

// ── Combined tracker ──

export async function trackPurchase(data: {
  userId?: number;
  email?: string;
  phone?: string;
  ipAddress?: string;
  userAgent?: string;
  orderId: string;
  totalAmount: number;
  items: { id: string; name: string; price: number; quantity: number }[];
}): Promise<void> {
  const event: TrackingEvent = {
    eventName: 'Purchase',
    userId: data.userId ?? undefined,
    email: data.email,
    phone: data.phone,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    value: data.totalAmount,
    currency: 'UAH',
    orderId: data.orderId,
    items: data.items,
  };

  // Fire both in parallel, non-blocking
  await Promise.allSettled([
    trackFacebookEvent(event),
    trackGA4Event({ ...event, eventName: 'purchase' }),
  ]);
}

export async function trackAddToCart(data: {
  userId?: number;
  itemId: string;
  itemName: string;
  price: number;
  quantity: number;
}): Promise<void> {
  const event: TrackingEvent = {
    eventName: 'AddToCart',
    userId: data.userId ?? undefined,
    value: data.price * data.quantity,
    currency: 'UAH',
    items: [{ id: data.itemId, name: data.itemName, price: data.price, quantity: data.quantity }],
  };

  await Promise.allSettled([
    trackFacebookEvent(event),
    trackGA4Event({ ...event, eventName: 'add_to_cart' }),
  ]);
}
