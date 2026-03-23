import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mockCheckRateLimit = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ allowed: true, remaining: 59, retryAfter: 0 })
);

vi.mock('@/services/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
}));

import { createApiHandler } from './api-handler';

const testConfig = { prefix: 'rl:test:', max: 60, windowSec: 60 };

function makeRequest(ip = '1.2.3.4'): NextRequest {
  return new NextRequest('http://localhost:3000/api/v1/test', {
    headers: { 'x-forwarded-for': ip },
  });
}

describe('createApiHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call handler and add rate limit headers when allowed', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 59, retryAfter: 0 });

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
    const wrapped = createApiHandler(testConfig, handler);
    const response = await wrapped(makeRequest());

    expect(handler).toHaveBeenCalledOnce();
    expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('59');
  });

  it('should return 429 when rate limit exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 30 });

    const handler = vi.fn();
    const wrapped = createApiHandler(testConfig, handler);
    const response = await wrapped(makeRequest());

    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('Забагато запитів');
  });

  it('should extract IP from x-forwarded-for header', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 59, retryAfter: 0 });

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = createApiHandler(testConfig, handler);
    await wrapped(makeRequest('10.0.0.1'));

    expect(mockCheckRateLimit).toHaveBeenCalledWith('10.0.0.1', testConfig);
  });

  it('should extract IP from x-real-ip when x-forwarded-for is absent', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 59, retryAfter: 0 });

    const request = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { 'x-real-ip': '192.168.1.1' },
    });

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = createApiHandler(testConfig, handler);
    await wrapped(request);

    expect(mockCheckRateLimit).toHaveBeenCalledWith('192.168.1.1', testConfig);
  });

  it('should use "unknown" when no IP headers present', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 59, retryAfter: 0 });

    const request = new NextRequest('http://localhost:3000/api/v1/test');
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = createApiHandler(testConfig, handler);
    await wrapped(request);

    expect(mockCheckRateLimit).toHaveBeenCalledWith('unknown', testConfig);
  });

  it('should pass context to handler', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 59, retryAfter: 0 });

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = createApiHandler(testConfig, handler);
    const ctx = { params: { id: '123' } };
    await wrapped(makeRequest(), ctx);

    expect(handler).toHaveBeenCalledWith(expect.any(NextRequest), ctx);
  });
});
