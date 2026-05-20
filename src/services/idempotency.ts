import { createHash } from 'crypto';
import { redis } from '@/lib/redis';

const PREFIX = 'idem:';
const TTL = 86400; // 24 hours
// Marker stored while the request is still being processed. Returning this to
// a duplicate caller is enough to block them — the actual response will
// overwrite the marker once the work finishes.
export const IDEMPOTENCY_IN_FLIGHT = '__in_flight__';
const IN_FLIGHT_TTL = 60; // seconds — long enough for the order POST to finish, short enough to recover from a crashed worker.

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

/**
 * Atomically reserve the idempotency key with an "in-flight" marker. Returns:
 *  - { reserved: true }                       — caller is first; do the work.
 *  - { reserved: false, cached: <body> }      — duplicate after work finished; return cached body.
 *  - { reserved: false, inFlight: true }      — duplicate while work is still running; reject 409.
 *
 * This closes the race where two requests with the same key both see "no
 * cached response" and both end up creating a duplicate order.
 */
export async function reserveIdempotencyKey(
  key: string,
): Promise<
  | { reserved: true }
  | { reserved: false; cached: string }
  | { reserved: false; inFlight: true }
> {
  const hashedKey = `${PREFIX}${hashKey(key)}`;
  const acquired = await redis.set(hashedKey, IDEMPOTENCY_IN_FLIGHT, 'EX', IN_FLIGHT_TTL, 'NX');
  if (acquired === 'OK') {
    return { reserved: true };
  }
  const existing = await redis.get(hashedKey);
  if (existing === IDEMPOTENCY_IN_FLIGHT) {
    return { reserved: false, inFlight: true };
  }
  return { reserved: false, cached: existing ?? '' };
}
