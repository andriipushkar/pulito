import { prisma } from '@/lib/prisma';
import { redis, CACHE_TTL } from '@/lib/redis';

const CACHE_PREFIX = 'ff:';
const ALL_FLAGS_KEY = 'ff:all';

interface FeatureFlagData {
  key: string;
  description?: string | null;
  isEnabled?: boolean;
  rolloutPercent?: number;
  targetRoles?: string[];
  targetUserIds?: number[];
}

/**
 * Hash userId to a 0-99 bucket for stable rollout.
 */
function hashUserId(userId: number): number {
  // Simple but deterministic: multiply by prime, take mod 100
  return Math.abs(((userId * 2654435761) >>> 0) % 100);
}

async function invalidateCache(key?: string) {
  try {
    await redis.del(ALL_FLAGS_KEY);
    if (key) await redis.del(`${CACHE_PREFIX}${key}`);
  } catch {
    // Redis down — skip cache invalidation
  }
}

export async function getFlag(key: string) {
  // Try cache first
  try {
    const cached = await redis.get(`${CACHE_PREFIX}${key}`);
    if (cached) return JSON.parse(cached);
  } catch {
    // Redis down — fall through to DB
  }

  const flag = await prisma.featureFlag.findUnique({ where: { key } });

  if (flag) {
    try {
      await redis.set(`${CACHE_PREFIX}${key}`, JSON.stringify(flag), 'EX', CACHE_TTL.SHORT);
    } catch {
      // Redis down — skip caching
    }
  }

  return flag;
}

export async function getAllFlags() {
  // Try cache first
  try {
    const cached = await redis.get(ALL_FLAGS_KEY);
    if (cached) return JSON.parse(cached);
  } catch {
    // Redis down — fall through to DB
  }

  const flags = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });

  try {
    await redis.set(ALL_FLAGS_KEY, JSON.stringify(flags), 'EX', CACHE_TTL.SHORT);
  } catch {
    // Redis down — skip caching
  }

  return flags;
}

export async function createFlag(data: FeatureFlagData) {
  const flag = await prisma.featureFlag.create({
    data: {
      key: data.key,
      description: data.description ?? null,
      isEnabled: data.isEnabled ?? false,
      rolloutPercent: data.rolloutPercent ?? 100,
      targetRoles: data.targetRoles ?? [],
      targetUserIds: data.targetUserIds ?? [],
    },
  });
  await invalidateCache();
  return flag;
}

export async function updateFlag(key: string, data: Partial<FeatureFlagData>) {
  const flag = await prisma.featureFlag.update({
    where: { key },
    data: {
      ...(data.description !== undefined && { description: data.description }),
      ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
      ...(data.rolloutPercent !== undefined && { rolloutPercent: data.rolloutPercent }),
      ...(data.targetRoles !== undefined && { targetRoles: data.targetRoles }),
      ...(data.targetUserIds !== undefined && { targetUserIds: data.targetUserIds }),
    },
  });
  await invalidateCache(key);
  return flag;
}

export async function deleteFlag(key: string) {
  await prisma.featureFlag.delete({ where: { key } });
  await invalidateCache(key);
}

/**
 * Check if a feature is enabled for a specific user context.
 * - isEnabled must be true
 * - If targetUserIds is non-empty, userId must be in the list
 * - If targetRoles is non-empty, userRole must be in the list
 * - rolloutPercent: hash(userId) % 100 must be < rolloutPercent
 */
export async function isFeatureEnabled(
  key: string,
  userId?: number,
  userRole?: string
): Promise<boolean> {
  const flag = await getFlag(key);
  if (!flag) return false;
  if (!flag.isEnabled) return false;

  // Check targetUserIds (if non-empty, user must be in the list)
  if (flag.targetUserIds.length > 0) {
    if (!userId || !flag.targetUserIds.includes(userId)) {
      return false;
    }
  }

  // Check targetRoles (if non-empty, role must match)
  if (flag.targetRoles.length > 0) {
    if (!userRole || !flag.targetRoles.includes(userRole)) {
      return false;
    }
  }

  // Check rollout percentage (needs userId for stable bucketing)
  if (flag.rolloutPercent < 100) {
    if (!userId) return false;
    if (hashUserId(userId) >= flag.rolloutPercent) {
      return false;
    }
  }

  return true;
}
