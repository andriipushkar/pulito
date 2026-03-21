import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/redis', () => ({
  redis: { get: vi.fn(), set: vi.fn(), setex: vi.fn() },
}));

import { redis } from '@/lib/redis';
import { getIdempotentResponse, setIdempotentResponse, updateIdempotentResponse } from './idempotency';

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
  it('stores with NX flag and returns true on success', async () => {
    vi.mocked(redis.set).mockResolvedValue('OK' as any);

    const result = await setIdempotentResponse('abc-123', '{"ok":true}');

    expect(result).toBe(true);
    expect(redis.set).toHaveBeenCalledWith('idem:abc-123', '{"ok":true}', 'EX', 86400, 'NX');
  });

  it('returns false when key already exists', async () => {
    vi.mocked(redis.set).mockResolvedValue(null as any);

    const result = await setIdempotentResponse('abc-123', '{"ok":true}');

    expect(result).toBe(false);
  });
});

describe('updateIdempotentResponse', () => {
  it('overwrites existing key with TTL', async () => {
    vi.mocked(redis.setex).mockResolvedValue('OK' as any);

    await updateIdempotentResponse('abc-123', '{"updated":true}');

    expect(redis.setex).toHaveBeenCalledWith('idem:abc-123', 86400, '{"updated":true}');
  });
});
