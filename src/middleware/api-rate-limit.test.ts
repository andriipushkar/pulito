import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./rate-limit-config', () => ({
  getRouteLimit: vi.fn().mockReturnValue({ max: 3, window: 60 }),
}));

// We need to reset the module state between tests since it uses in-memory Map
let checkApiRateLimit: typeof import('./api-rate-limit').checkApiRateLimit;

beforeEach(async () => {
  vi.resetModules();
  vi.mock('./rate-limit-config', () => ({
    getRouteLimit: vi.fn().mockReturnValue({ max: 3, window: 60 }),
  }));
  const mod = await import('./api-rate-limit');
  checkApiRateLimit = mod.checkApiRateLimit;
});

describe('checkApiRateLimit', () => {
  it('allows first request and returns remaining count', async () => {
    const result = await checkApiRateLimit('/api/v1/auth', '192.168.1.1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2); // max(3) - 1
  });

  it('allows requests under the limit', async () => {
    await checkApiRateLimit('/api/v1/auth', '10.0.0.1');
    await checkApiRateLimit('/api/v1/auth', '10.0.0.1');
    const result = await checkApiRateLimit('/api/v1/auth', '10.0.0.1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('blocks requests over the limit', async () => {
    await checkApiRateLimit('/api/v1/auth', '10.0.0.2');
    await checkApiRateLimit('/api/v1/auth', '10.0.0.2');
    await checkApiRateLimit('/api/v1/auth', '10.0.0.2');
    const result = await checkApiRateLimit('/api/v1/auth', '10.0.0.2');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('isolates rate limits per IP', async () => {
    // Max out IP A
    await checkApiRateLimit('/api/v1/auth', '1.1.1.1');
    await checkApiRateLimit('/api/v1/auth', '1.1.1.1');
    await checkApiRateLimit('/api/v1/auth', '1.1.1.1');
    const blockedA = await checkApiRateLimit('/api/v1/auth', '1.1.1.1');
    expect(blockedA.allowed).toBe(false);

    // IP B should still be allowed
    const allowedB = await checkApiRateLimit('/api/v1/auth', '2.2.2.2');
    expect(allowedB.allowed).toBe(true);
  });

  it('isolates rate limits per route path', async () => {
    // Max out one route
    await checkApiRateLimit('/api/v1/auth', '3.3.3.3');
    await checkApiRateLimit('/api/v1/auth', '3.3.3.3');
    await checkApiRateLimit('/api/v1/auth', '3.3.3.3');

    // Different route for same IP should still be allowed
    const result = await checkApiRateLimit('/api/v1/products', '3.3.3.3');
    expect(result.allowed).toBe(true);
  });
});
