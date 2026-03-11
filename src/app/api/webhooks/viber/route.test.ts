import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockHandleViberEvent = vi.fn();
const mockVerifyViberSignature = vi.fn();

vi.mock('@/services/viber', () => ({
  handleViberEvent: (...args: unknown[]) => mockHandleViberEvent(...args),
  verifyViberSignature: (...args: unknown[]) => mockVerifyViberSignature(...args),
}));

import { POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  mockHandleViberEvent.mockResolvedValue(undefined);
  mockVerifyViberSignature.mockReturnValue(true);
});

describe('POST /api/webhooks/viber', () => {
  it('should process event and return status 0', async () => {
    const event = { event: 'subscribed', user: { id: 'user1', name: 'Test' } };
    const request = new NextRequest('http://localhost/api/webhooks/viber', {
      method: 'POST',
      body: JSON.stringify(event),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(request);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe(0);
    await new Promise((r) => setTimeout(r, 10));
    expect(mockHandleViberEvent).toHaveBeenCalledWith(event);
  });

  it('should return 403 for invalid signature', async () => {
    mockVerifyViberSignature.mockReturnValue(false);

    const request = new NextRequest('http://localhost/api/webhooks/viber', {
      method: 'POST',
      body: JSON.stringify({ event: 'message' }),
      headers: {
        'content-type': 'application/json',
        'x-viber-content-signature': 'invalid',
      },
    });

    const res = await POST(request);
    expect(res.status).toBe(403);
  });

  it('should verify signature with body and header', async () => {
    const body = JSON.stringify({ event: 'message' });
    const request = new NextRequest('http://localhost/api/webhooks/viber', {
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/json',
        'x-viber-content-signature': 'abc123',
      },
    });

    await POST(request);
    expect(mockVerifyViberSignature).toHaveBeenCalledWith(body, 'abc123');
  });

  it('should handle async processing error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockHandleViberEvent.mockRejectedValue(new Error('processing failed'));

    const request = new NextRequest('http://localhost/api/webhooks/viber', {
      method: 'POST',
      body: JSON.stringify({ event: 'message' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(consoleSpy).toHaveBeenCalledWith('Viber processing error:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('should always return 200 even on parse error', async () => {
    const request = new NextRequest('http://localhost/api/webhooks/viber', {
      method: 'POST',
      body: 'invalid',
      headers: { 'content-type': 'text/plain' },
    });

    // verifyViberSignature is called before JSON.parse
    mockVerifyViberSignature.mockReturnValue(true);

    const res = await POST(request);
    // The route catches errors and returns status 0
    expect(res.status).toBe(200);
  });
});
