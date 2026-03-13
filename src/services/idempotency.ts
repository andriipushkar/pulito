import { redis } from '@/lib/redis';

const PREFIX = 'idem:';
const TTL = 86400; // 24 hours

/**
 * Check if an idempotency key has been used. If so, return the cached response.
 * If not, return null (caller should proceed and then store the result).
 */
export async function getIdempotentResponse(key: string): Promise<string | null> {
  return redis.get(`${PREFIX}${key}`);
}

/**
 * Store the response for an idempotency key.
 */
export async function setIdempotentResponse(key: string, responseBody: string): Promise<void> {
  await redis.setex(`${PREFIX}${key}`, TTL, responseBody);
}
