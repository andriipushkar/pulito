import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';

vi.mock('@/lib/redis', () => ({
  redis: { get: vi.fn(), set: vi.fn(), setex: vi.fn() },
}));

import { redis } from '@/lib/redis';
import { getIdempotentResponse, setIdempotentResponse, updateIdempotentResponse } from './idempotency';

const hash = (key: string) => createHash('sha256').update(key).digest('hex');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getIdempotentResponse', () => {
  it('returns cached value using hashed key', async () => {
    vi.mocked(redis.get).mockResolvedValue('{"ok":true}');

    const result = await getIdempotentResponse('abc-123');

    expect(result).toBe('{"ok":true}');
    expect(redis.get).toHaveBeenCalledWith(`idem:${hash('abc-123')}`);
  });

  it('returns null for missing key', async () => {
    vi.mocked(redis.get).mockResolvedValue(null);

    const result = await getIdempotentResponse('missing');

    expect(result).toBeNull();
  });
});

describe('setIdempotentResponse', () => {
  it('stores with NX flag using hashed key and returns true on success', async () => {
    vi.mocked(redis.set).mockResolvedValue('OK' as any);

    const result = await setIdempotentResponse('abc-123', '{"ok":true}');

    expect(result).toBe(true);
    expect(redis.set).toHaveBeenCalledWith(`idem:${hash('abc-123')}`, '{"ok":true}', 'EX', 86400, 'NX');
  });

  it('returns false when key already exists', async () => {
    vi.mocked(redis.set).mockResolvedValue(null as any);

    const result = await setIdempotentResponse('abc-123', '{"ok":true}');

    expect(result).toBe(false);
  });
});

describe('updateIdempotentResponse', () => {
  it('overwrites existing key with TTL using hashed key', async () => {
    vi.mocked(redis.setex).mockResolvedValue('OK' as any);

    await updateIdempotentResponse('abc-123', '{"updated":true}');

    expect(redis.setex).toHaveBeenCalledWith(`idem:${hash('abc-123')}`, 86400, '{"updated":true}');
  });
});
