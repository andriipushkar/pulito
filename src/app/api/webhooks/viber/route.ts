import { NextRequest, NextResponse } from 'next/server';
import { handleViberEvent, verifyViberSignature } from '@/services/viber';
import { redis } from '@/lib/redis';

// Viber retries failed deliveries. Dedupe by message_id (or timestamp+user_id
// fallback) for 24h so a retry doesn't re-create feedback rows or re-fire
// auto-replies. Mirrors the Telegram update_id strategy.
async function isDuplicateViberEvent(event: {
  message_token?: string | number;
  timestamp?: number;
  user_id?: string;
  sender?: { id?: string };
}): Promise<boolean> {
  const token =
    event.message_token != null
      ? `mt:${event.message_token}`
      : event.timestamp != null
        ? `ts:${event.timestamp}:${event.user_id || event.sender?.id || ''}`
        : null;
  if (!token) return false;
  try {
    const set = await redis.set(`vb:dedupe:${token}`, '1', 'EX', 86_400, 'NX');
    return set !== 'OK';
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-viber-content-signature') || '';

    if (!verifyViberSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const event = JSON.parse(rawBody);

    if (await isDuplicateViberEvent(event)) {
      return NextResponse.json({ status: 0, deduped: true });
    }

    // Process asynchronously
    handleViberEvent(event).catch((err) => console.error('Viber processing error:', err));

    return NextResponse.json({ status: 0 });
  } catch {
    return NextResponse.json({ status: 0 }); // Always return success to Viber
  }
}
