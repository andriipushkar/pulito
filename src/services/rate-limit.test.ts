import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRedis = vi.hoisted(() => ({
  get: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
  del: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({
  redis: mockRedis,
}));

import {
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginAttempts,
  RateLimitError,
} from './rate-limit';

describe('rate-limit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RateLimitError', () => {
    it('creates error with status 429 and retryAfter', () => {
      const err = new RateLimitError('too many', 429, 60);
      expect(err.message).toBe('too many');
      expect(err.statusCode).toBe(429);
      expect(err.retryAfter).toBe(60);
      expect(err.name).toBe('RateLimitError');
    });
  });

  describe('checkLoginRateLimit', () => {
    it('does not throw when under the limit', async () => {
      mockRedis.get.mockResolvedValue('2');
      await expect(checkLoginRateLimit('1.2.3.4', 'user@test.com')).resolves.toBeUndefined();
    });

    it('throws RateLimitError when at max attempts', async () => {
      mockRedis.get.mockResolvedValue('5');
      mockRedis.ttl.mockResolvedValue(600);
      await expect(checkLoginRateLimit('1.2.3.4', 'user@test.com')).rejects.toThrow(
        RateLimitError
      );
    });

    it('lowercases email in key', async () => {
      mockRedis.get.mockResolvedValue(null);
      await checkLoginRateLimit('1.2.3.4', 'User@Test.COM');
      expect(mockRedis.get).toHaveBeenCalledWith('rl:login:1.2.3.4:user@test.com');
    });
  });

  describe('recordFailedLogin', () => {
    it('increments count and sets expiry on first attempt', async () => {
      mockRedis.incr.mockResolvedValue(1);
      await recordFailedLogin('1.2.3.4', 'user@test.com');
      expect(mockRedis.incr).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'rl:login:1.2.3.4:user@test.com',
        900
      );
    });

    it('does not set expiry on subsequent attempts', async () => {
      mockRedis.incr.mockResolvedValue(3);
      await recordFailedLogin('1.2.3.4', 'user@test.com');
      expect(mockRedis.incr).toHaveBeenCalled();
      expect(mockRedis.expire).not.toHaveBeenCalled();
    });
  });

  describe('clearLoginAttempts', () => {
    it('deletes the key', async () => {
      await clearLoginAttempts('1.2.3.4', 'user@test.com');
      expect(mockRedis.del).toHaveBeenCalledWith('rl:login:1.2.3.4:user@test.com');
    });
  });

  describe('RateLimitError - defaults', () => {
    it('defaults to 429 statusCode without retryAfter', () => {
      const err = new RateLimitError('too many');
      expect(err.statusCode).toBe(429);
      expect(err.retryAfter).toBeUndefined();
    });
  });

  describe('checkLoginRateLimit - ttl edge cases', () => {
    it('uses BLOCK_DURATION when ttl is negative', async () => {
      mockRedis.get.mockResolvedValue('5');
      mockRedis.ttl.mockResolvedValue(-1);

      try {
        await checkLoginRateLimit('1.2.3.4', 'user@test.com');
      } catch (err) {
        expect((err as RateLimitError).retryAfter).toBe(900);
      }
    });

    it('uses actual ttl when positive', async () => {
      mockRedis.get.mockResolvedValue('10');
      mockRedis.ttl.mockResolvedValue(300);

      try {
        await checkLoginRateLimit('1.2.3.4', 'user@test.com');
      } catch (err) {
        expect((err as RateLimitError).retryAfter).toBe(300);
      }
    });

    it('does not throw when current is null', async () => {
      mockRedis.get.mockResolvedValue(null);
      await expect(checkLoginRateLimit('1.2.3.4', 'user@test.com')).resolves.toBeUndefined();
    });
  });
});
