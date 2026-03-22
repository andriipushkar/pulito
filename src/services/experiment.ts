import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { createHash } from 'crypto';

const CACHE_PREFIX = 'exp:';
const CACHE_TTL = 300; // 5 min

interface Experiment {
  id: number;
  key: string;
  variants: string[]; // e.g. ['control', 'variant_a', 'variant_b']
  weights: number[];   // e.g. [50, 25, 25] — must sum to 100
  isActive: boolean;
}

/**
 * Get the variant for a user in an experiment.
 * Uses deterministic hashing (userId + experimentKey) for consistent assignment.
 */
export function assignVariant(experimentKey: string, userId: string, variants: string[], weights: number[]): string {
  const hash = createHash('md5').update(`${experimentKey}:${userId}`).digest('hex');
  const bucket = parseInt(hash.slice(0, 8), 16) % 100;

  let cumulative = 0;
  for (let i = 0; i < variants.length; i++) {
    cumulative += weights[i];
    if (bucket < cumulative) return variants[i];
  }

  return variants[0]; // fallback to first
}

/**
 * Get active experiment by key, with Redis caching.
 */
export async function getExperiment(key: string): Promise<Experiment | null> {
  const cacheKey = `${CACHE_PREFIX}${key}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    // Redis unavailable
  }

  const setting = await prisma.setting.findUnique({
    where: { key: `experiment_${key}` },
  });

  if (!setting?.value) return null;

  const experiment = JSON.parse(setting.value) as Experiment;

  try {
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(experiment));
  } catch {
    // best effort
  }

  return experiment;
}

/**
 * Get user's variant for an experiment.
 */
export async function getUserVariant(experimentKey: string, userId: string): Promise<string | null> {
  const experiment = await getExperiment(experimentKey);
  if (!experiment?.isActive) return null;

  return assignVariant(experimentKey, userId, experiment.variants, experiment.weights);
}

/**
 * Track a conversion event for an experiment variant.
 */
export async function trackConversion(experimentKey: string, variant: string): Promise<void> {
  const key = `exp_conversion:${experimentKey}:${variant}`;
  try {
    await redis.incr(key);
  } catch {
    // best effort
  }
}

/**
 * Get experiment results with conversion counts.
 */
export async function getExperimentResults(experimentKey: string): Promise<Record<string, number>> {
  const experiment = await getExperiment(experimentKey);
  if (!experiment) return {};

  const results: Record<string, number> = {};
  for (const variant of experiment.variants) {
    const key = `exp_conversion:${experimentKey}:${variant}`;
    try {
      const count = await redis.get(key);
      results[variant] = parseInt(count || '0', 10);
    } catch {
      results[variant] = 0;
    }
  }

  return results;
}
