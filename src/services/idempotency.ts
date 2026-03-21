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
 * Atomically acquire an idempotency lock and store the response.
 * Uses NX (set-if-not-exists) to prevent race conditions on concurrent requests.
 * Returns true if stored successfully, false if key already exists.
 */
export async function setIdempotentResponse(key: string, responseBody: string): Promise<boolean> {
  const result = await redis.set(`${PREFIX}${key}`, responseBody, 'EX', TTL, 'NX');
  return result === 'OK';
}

/**
 * Overwrite an existing idempotency response (e.g. after processing completes).
 */
export async function updateIdempotentResponse(key: string, responseBody: string): Promise<void> {
  await redis.setex(`${PREFIX}${key}`, TTL, responseBody);
}
