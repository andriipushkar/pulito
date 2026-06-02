import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockHandleTelegramUpdate = vi.fn();

vi.mock('@/services/telegram', () => ({
  handleTelegramUpdate: (...args: unknown[]) => mockHandleTelegramUpdate(...args),
}));

// Dedup uses redis SET NX (→ 'OK' = first-seen) and the rate-limiter uses
// incr/expire. Mock all of them: a real redis on the box would return a stale
// dedup key (TTL 24h) from a prior run, masking the update as a duplicate.
vi.mock('@/lib/redis', () => ({
  redis: {
    set: vi.fn().mockResolvedValue('OK'),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
  },
}));

import { POST } from './route';
import { logger } from '@/lib/logger';

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mockHandleTelegramUpdate.mockResolvedValue(undefined);
});

describe('POST /api/webhooks/telegram', () => {
  it('should process update and return ok', async () => {
    const update = { update_id: 123, message: { chat: { id: 1 }, text: '/start' } };
    const request = new NextRequest('http://localhost/api/webhooks/telegram', {
      method: 'POST',
      body: JSON.stringify(update),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(request);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    // Wait for async handler
    await new Promise((r) => setTimeout(r, 10));
    expect(mockHandleTelegramUpdate).toHaveBeenCalledWith(update);
  });

  it('should return 401 when secret token is configured but missing in request', async () => {
    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', 'my-secret');

    const request = new NextRequest('http://localhost/api/webhooks/telegram', {
      method: 'POST',
      body: JSON.stringify({ update_id: 1 }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(request);
    expect(res.status).toBe(401);
  });

  it('should accept request with correct secret token', async () => {
    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', 'my-secret');

    const request = new NextRequest('http://localhost/api/webhooks/telegram', {
      method: 'POST',
      body: JSON.stringify({ update_id: 1 }),
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': 'my-secret',
      },
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
  });

  it('should handle async processing error gracefully', async () => {
    // Async failures are logged via logger.error (message + structured error),
    // not console.error; the request still returns 200 (update was accepted).
    const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    mockHandleTelegramUpdate.mockRejectedValue(new Error('processing failed'));

    const request = new NextRequest('http://localhost/api/webhooks/telegram', {
      method: 'POST',
      body: JSON.stringify({ update_id: 999 }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    // Wait for async .catch to fire
    await new Promise((r) => setTimeout(r, 50));
    expect(loggerSpy).toHaveBeenCalledWith(
      'Telegram processing error',
      expect.objectContaining({ error: 'processing failed' }),
    );
    loggerSpy.mockRestore();
  });

  it('returns 500 on parse error (no longer masks failures with a blanket 200)', async () => {
    const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const request = new NextRequest('http://localhost/api/webhooks/telegram', {
      method: 'POST',
      body: 'invalid json',
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(request);
    // Bad JSON is a genuine error — surface 500 so Telegram retries (the old
    // catch-all 200 silently swallowed malformed/failed updates).
    expect(res.status).toBe(500);
    loggerSpy.mockRestore();
  });
});
