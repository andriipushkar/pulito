import { createHash } from 'crypto';
import { redis } from '@/lib/redis';

const PREFIX = 'idem:';
const TTL = 86400; // 24 hours

/**
 * Hash the idempotency key to a fixed-length string.
 * Prevents large keys in Redis and handles any input safely.
 */
function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Check if an idempotency key has been used. If so, return the cached response.
 * If not, return null (caller should proceed and then store the result).
 */
export async function getIdempotentResponse(key: string): Promise<string | null> {
  return redis.get(`${PREFIX}${hashKey(key)}`);
}

/**
 * Atomically acquire an idempotency lock and store the response.
 * Uses NX (set-if-not-exists) to prevent race conditions on concurrent requests.
 * Returns true if stored successfully, false if key already exists.
 */
export async function setIdempotentResponse(key: string, responseBody: string): Promise<boolean> {
  const result = await redis.set(`${PREFIX}${hashKey(key)}`, responseBody, 'EX', TTL, 'NX');
  return result === 'OK';
}

/**
 * Overwrite an existing idempotency response (e.g. after processing completes).
 */
export async function updateIdempotentResponse(key: string, responseBody: string): Promise<void> {
  await redis.setex(`${PREFIX}${hashKey(key)}`, TTL, responseBody);
}
