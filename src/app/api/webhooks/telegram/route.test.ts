import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockHandleTelegramUpdate = vi.fn();

vi.mock('@/services/telegram', () => ({
  handleTelegramUpdate: (...args: unknown[]) => mockHandleTelegramUpdate(...args),
}));

import { POST } from './route';

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
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
    expect(consoleSpy).toHaveBeenCalledWith('Telegram processing error:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('should always return 200 even on parse error', async () => {
    const request = new NextRequest('http://localhost/api/webhooks/telegram', {
      method: 'POST',
      body: 'invalid json',
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
  });
});
