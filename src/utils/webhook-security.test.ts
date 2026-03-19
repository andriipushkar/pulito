import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({
  env: {
    DATABASE_URL: 'postgres://test',
    JWT_SECRET: 'a]3Kf9$mPz!wQr7vLx2NhBt5YdCjEu8G',
    APP_SECRET: 'b]3Kf9$mPz!wQr7vLx2NhBt5YdCjEu8G',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    NODE_ENV: 'test',
  },
}));

const mockRedis = {
  incr: vi.fn(),
  expire: vi.fn(),
};

vi.mock('@/lib/redis', () => ({
  redis: mockRedis,
}));

import { isIpAllowed, checkWebhookRateLimit } from './webhook-security';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isIpAllowed', () => {
  it('returns true for known provider with empty IP list (liqpay)', () => {
    expect(isIpAllowed('liqpay', '1.2.3.4')).toBe(true);
  });

  it('returns true for known provider with empty IP list (monobank)', () => {
    expect(isIpAllowed('monobank', '10.0.0.1')).toBe(true);
  });

  it('returns true for known provider with empty IP list (wayforpay)', () => {
    expect(isIpAllowed('wayforpay', '192.168.1.1')).toBe(true);
  });

  it('returns true for unknown provider', () => {
    expect(isIpAllowed('unknown_provider', '1.2.3.4')).toBe(true);
  });
});

describe('checkWebhookRateLimit', () => {
  it('returns true when under rate limit', async () => {
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);

    const result = await checkWebhookRateLimit('liqpay', '1.2.3.4');

    expect(result).toBe(true);
    expect(mockRedis.incr).toHaveBeenCalledWith('webhook_rl:liqpay:1.2.3.4');
    expect(mockRedis.expire).toHaveBeenCalledWith('webhook_rl:liqpay:1.2.3.4', 60);
  });

  it('sets expire only on first increment (count === 1)', async () => {
    mockRedis.incr.mockResolvedValue(5);

    await checkWebhookRateLimit('monobank', '10.0.0.1');

    expect(mockRedis.expire).not.toHaveBeenCalled();
  });

  it('returns true at exactly 100 requests', async () => {
    mockRedis.incr.mockResolvedValue(100);

    const result = await checkWebhookRateLimit('liqpay', '1.2.3.4');

    expect(result).toBe(true);
  });

  it('returns false when over rate limit (101)', async () => {
    mockRedis.incr.mockResolvedValue(101);

    const result = await checkWebhookRateLimit('liqpay', '1.2.3.4');

    expect(result).toBe(false);
  });

  it('uses correct key format with provider and IP', async () => {
    mockRedis.incr.mockResolvedValue(2);

    await checkWebhookRateLimit('wayforpay', '192.168.0.1');

    expect(mockRedis.incr).toHaveBeenCalledWith('webhook_rl:wayforpay:192.168.0.1');
  });
});
