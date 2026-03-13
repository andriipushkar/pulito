import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/redis', () => ({
  redis: { get: vi.fn(), setex: vi.fn() },
}));

import { redis } from '@/lib/redis';
import { getIdempotentResponse, setIdempotentResponse } from './idempotency';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getIdempotentResponse', () => {
  it('returns cached value', async () => {
    vi.mocked(redis.get).mockResolvedValue('{"ok":true}');

    const result = await getIdempotentResponse('abc-123');

    expect(result).toBe('{"ok":true}');
    expect(redis.get).toHaveBeenCalledWith('idem:abc-123');
  });

  it('returns null for missing key', async () => {
    vi.mocked(redis.get).mockResolvedValue(null);

    const result = await getIdempotentResponse('missing');

    expect(result).toBeNull();
    expect(redis.get).toHaveBeenCalledWith('idem:missing');
  });
});

describe('setIdempotentResponse', () => {
  it('stores with TTL of 86400', async () => {
    vi.mocked(redis.setex).mockResolvedValue('OK' as any);

    await setIdempotentResponse('abc-123', '{"ok":true}');

    expect(redis.setex).toHaveBeenCalledWith('idem:abc-123', 86400, '{"ok":true}');
  });
});
