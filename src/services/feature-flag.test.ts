import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRedis = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

const mockPrisma = vi.hoisted(() => ({
  featureFlag: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: mockRedis,
  CACHE_TTL: { SHORT: 60, MEDIUM: 300, LONG: 3600, DAY: 86400 },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import {
  getFlag,
  getAllFlags,
  createFlag,
  updateFlag,
  deleteFlag,
  isFeatureEnabled,
} from './feature-flag';

describe('feature-flag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFlag', () => {
    it('returns cached flag from Redis', async () => {
      const flag = { key: 'test', isEnabled: true, rolloutPercent: 100, targetRoles: [], targetUserIds: [] };
      mockRedis.get.mockResolvedValue(JSON.stringify(flag));

      const result = await getFlag('test');
      expect(result).toEqual(flag);
      expect(mockPrisma.featureFlag.findUnique).not.toHaveBeenCalled();
    });

    it('falls back to DB when cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      const flag = { key: 'test', isEnabled: true, rolloutPercent: 100, targetRoles: [], targetUserIds: [] };
      mockPrisma.featureFlag.findUnique.mockResolvedValue(flag);

      const result = await getFlag('test');
      expect(result).toEqual(flag);
      expect(mockRedis.set).toHaveBeenCalledWith('ff:test', JSON.stringify(flag), 'EX', 60);
    });

    it('falls back to DB when Redis errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('connection refused'));
      const flag = { key: 'test', isEnabled: true, rolloutPercent: 100, targetRoles: [], targetUserIds: [] };
      mockPrisma.featureFlag.findUnique.mockResolvedValue(flag);

      const result = await getFlag('test');
      expect(result).toEqual(flag);
    });

    it('returns null for non-existent flag', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.featureFlag.findUnique.mockResolvedValue(null);

      const result = await getFlag('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getAllFlags', () => {
    it('returns cached flags from Redis', async () => {
      const flags = [{ key: 'a' }, { key: 'b' }];
      mockRedis.get.mockResolvedValue(JSON.stringify(flags));

      const result = await getAllFlags();
      expect(result).toEqual(flags);
    });

    it('falls back to DB on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      const flags = [{ key: 'a' }];
      mockPrisma.featureFlag.findMany.mockResolvedValue(flags);

      const result = await getAllFlags();
      expect(result).toEqual(flags);
      expect(mockRedis.set).toHaveBeenCalled();
    });
  });

  describe('createFlag', () => {
    it('creates flag and invalidates cache', async () => {
      const flag = { key: 'new-flag', isEnabled: false };
      mockPrisma.featureFlag.create.mockResolvedValue(flag);
      mockRedis.del.mockResolvedValue(1);

      const result = await createFlag({ key: 'new-flag' });
      expect(result).toEqual(flag);
      expect(mockRedis.del).toHaveBeenCalledWith('ff:all');
    });
  });

  describe('updateFlag', () => {
    it('updates flag and invalidates cache', async () => {
      const flag = { key: 'test', isEnabled: true };
      mockPrisma.featureFlag.update.mockResolvedValue(flag);
      mockRedis.del.mockResolvedValue(1);

      const result = await updateFlag('test', { isEnabled: true });
      expect(result).toEqual(flag);
      expect(mockRedis.del).toHaveBeenCalledWith('ff:all');
      expect(mockRedis.del).toHaveBeenCalledWith('ff:test');
    });
  });

  describe('deleteFlag', () => {
    it('deletes flag and invalidates cache', async () => {
      mockPrisma.featureFlag.delete.mockResolvedValue({});
      mockRedis.del.mockResolvedValue(1);

      await deleteFlag('test');
      expect(mockPrisma.featureFlag.delete).toHaveBeenCalledWith({ where: { key: 'test' } });
      expect(mockRedis.del).toHaveBeenCalledWith('ff:test');
    });
  });

  describe('isFeatureEnabled', () => {
    const enabledFlag = {
      key: 'test',
      isEnabled: true,
      rolloutPercent: 100,
      targetRoles: [] as string[],
      targetUserIds: [] as number[],
    };

    beforeEach(() => {
      mockRedis.get.mockResolvedValue(null);
    });

    it('returns false for non-existent flag', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue(null);
      expect(await isFeatureEnabled('nonexistent')).toBe(false);
    });

    it('returns false when flag is disabled', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue({ ...enabledFlag, isEnabled: false });
      expect(await isFeatureEnabled('test')).toBe(false);
    });

    it('returns true when enabled with no targeting', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue(enabledFlag);
      expect(await isFeatureEnabled('test')).toBe(true);
    });

    it('returns true when userId is in targetUserIds', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue({
        ...enabledFlag,
        targetUserIds: [1, 42, 100],
      });
      expect(await isFeatureEnabled('test', 42)).toBe(true);
    });

    it('returns false when userId is NOT in targetUserIds', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue({
        ...enabledFlag,
        targetUserIds: [1, 42, 100],
      });
      expect(await isFeatureEnabled('test', 999)).toBe(false);
    });

    it('returns false when targetUserIds set but no userId provided', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue({
        ...enabledFlag,
        targetUserIds: [1],
      });
      expect(await isFeatureEnabled('test')).toBe(false);
    });

    it('returns true when userRole matches targetRoles', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue({
        ...enabledFlag,
        targetRoles: ['admin', 'manager'],
      });
      expect(await isFeatureEnabled('test', 1, 'admin')).toBe(true);
    });

    it('returns false when userRole does NOT match targetRoles', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue({
        ...enabledFlag,
        targetRoles: ['admin'],
      });
      expect(await isFeatureEnabled('test', 1, 'client')).toBe(false);
    });

    it('returns false when rolloutPercent is 0', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue({
        ...enabledFlag,
        rolloutPercent: 0,
      });
      expect(await isFeatureEnabled('test', 1)).toBe(false);
    });

    it('returns false for rollout check without userId', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue({
        ...enabledFlag,
        rolloutPercent: 50,
      });
      expect(await isFeatureEnabled('test')).toBe(false);
    });

    it('rollout is deterministic for same userId', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue({
        ...enabledFlag,
        rolloutPercent: 50,
      });

      const result1 = await isFeatureEnabled('test', 42);
      const result2 = await isFeatureEnabled('test', 42);
      expect(result1).toBe(result2);
    });
  });
});
