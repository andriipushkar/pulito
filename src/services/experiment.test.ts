import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRedis = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  incr: vi.fn(),
}));

const mockPrisma = vi.hoisted(() => ({
  setting: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: mockRedis,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import {
  assignVariant,
  getUserVariant,
  trackConversion,
  getExperimentResults,
} from './experiment';

const ACTIVE_EXPERIMENT = {
  id: 1,
  key: 'homepage_cta',
  variants: ['control', 'variant_a', 'variant_b'],
  weights: [50, 25, 25],
  isActive: true,
};

const INACTIVE_EXPERIMENT = {
  ...ACTIVE_EXPERIMENT,
  isActive: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('assignVariant', () => {
  it('is deterministic — same input always produces same output', () => {
    const result1 = assignVariant('exp1', 'user123', ['control', 'variant_a'], [50, 50]);
    const result2 = assignVariant('exp1', 'user123', ['control', 'variant_a'], [50, 50]);
    const result3 = assignVariant('exp1', 'user123', ['control', 'variant_a'], [50, 50]);

    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });

  it('distributes users across variants', () => {
    const variants = ['control', 'variant_a', 'variant_b'];
    const weights = [34, 33, 33];
    const counts: Record<string, number> = { control: 0, variant_a: 0, variant_b: 0 };

    // Assign 200 different users
    for (let i = 0; i < 200; i++) {
      const variant = assignVariant('test_exp', `user_${i}`, variants, weights);
      counts[variant]++;
    }

    // Each variant should get at least some users
    expect(counts.control).toBeGreaterThan(0);
    expect(counts.variant_a).toBeGreaterThan(0);
    expect(counts.variant_b).toBeGreaterThan(0);
    // Total should be 200
    expect(counts.control + counts.variant_a + counts.variant_b).toBe(200);
  });

  it('returns different variants for different user IDs', () => {
    // With enough users, at least two must differ
    const results = new Set<string>();
    for (let i = 0; i < 50; i++) {
      results.add(assignVariant('exp', `user_${i}`, ['a', 'b'], [50, 50]));
    }
    expect(results.size).toBeGreaterThan(1);
  });

  it('returns first variant as fallback', () => {
    // Weights that sum to 100 should always match, but test the fallback path
    const result = assignVariant('exp', 'user', ['fallback'], [100]);
    expect(result).toBe('fallback');
  });
});

describe('getUserVariant', () => {
  it('returns null for inactive experiment', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.setting.findUnique.mockResolvedValue({
      key: 'experiment_homepage_cta',
      value: JSON.stringify(INACTIVE_EXPERIMENT),
    });

    const result = await getUserVariant('homepage_cta', 'user1');

    expect(result).toBeNull();
  });

  it('returns a variant for active experiment', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.setting.findUnique.mockResolvedValue({
      key: 'experiment_homepage_cta',
      value: JSON.stringify(ACTIVE_EXPERIMENT),
    });

    const result = await getUserVariant('homepage_cta', 'user1');

    expect(result).not.toBeNull();
    expect(ACTIVE_EXPERIMENT.variants).toContain(result);
  });

  it('returns null when experiment does not exist', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.setting.findUnique.mockResolvedValue(null);

    const result = await getUserVariant('nonexistent', 'user1');

    expect(result).toBeNull();
  });

  it('uses cached experiment from Redis', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify(ACTIVE_EXPERIMENT));

    const result = await getUserVariant('homepage_cta', 'user1');

    expect(result).not.toBeNull();
    expect(mockPrisma.setting.findUnique).not.toHaveBeenCalled();
  });
});

describe('trackConversion', () => {
  it('increments Redis counter for experiment variant', async () => {
    mockRedis.incr.mockResolvedValue(5);

    await trackConversion('homepage_cta', 'variant_a');

    expect(mockRedis.incr).toHaveBeenCalledWith('exp_conversion:homepage_cta:variant_a');
  });

  it('does not throw when Redis fails', async () => {
    mockRedis.incr.mockRejectedValue(new Error('Redis unavailable'));

    await expect(trackConversion('homepage_cta', 'variant_a')).resolves.toBeUndefined();
  });
});

describe('getExperimentResults', () => {
  it('returns counts per variant', async () => {
    // Mock getExperiment (via Redis cache)
    mockRedis.get
      .mockResolvedValueOnce(JSON.stringify(ACTIVE_EXPERIMENT)) // getExperiment cache hit
      .mockResolvedValueOnce('42')   // control count
      .mockResolvedValueOnce('18')   // variant_a count
      .mockResolvedValueOnce('25');  // variant_b count

    const results = await getExperimentResults('homepage_cta');

    expect(results).toEqual({
      control: 42,
      variant_a: 18,
      variant_b: 25,
    });
  });

  it('returns empty object when experiment does not exist', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.setting.findUnique.mockResolvedValue(null);

    const results = await getExperimentResults('nonexistent');

    expect(results).toEqual({});
  });

  it('returns 0 for variants with no conversions', async () => {
    mockRedis.get
      .mockResolvedValueOnce(JSON.stringify(ACTIVE_EXPERIMENT))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const results = await getExperimentResults('homepage_cta');

    expect(results).toEqual({
      control: 0,
      variant_a: 0,
      variant_b: 0,
    });
  });
});
