import { timingSafeEqual } from 'crypto';

/**
 * Constant-time string compare. Returns false (and short-circuits) when lengths
 * differ — that early-exit *itself* leaks length, but the signature/secret
 * length is fixed per provider, so it's not exploitable here.
 *
 * Use for HMAC signatures, secret tokens, anything where a byte-by-byte
 * early-exit (plain `===` / `!==`) would let an attacker recover the value
 * via response-timing measurements.
 */
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Read request body as text with a hard size cap. Stops a malicious client
 * from forcing the parser to allocate hundreds of MB before validation runs.
 * Default 64KB covers every legit payment payload; pass higher for bot
 * webhooks (telegram can include media metadata).
 */
export async function readBoundedBody(request: Request, maxBytes: number): Promise<string> {
  const cl = request.headers.get('content-length');
  if (cl) {
    const n = Number(cl);
    if (Number.isFinite(n) && n > maxBytes) {
      throw new Error('PAYLOAD_TOO_LARGE');
    }
  }
  const text = await request.text();
  // Re-check post-read in case Content-Length was missing or lying.
  if (Buffer.byteLength(text, 'utf-8') > maxBytes) {
    throw new Error('PAYLOAD_TOO_LARGE');
  }
  return text;
}

// Known payment provider IP ranges
// These providers do not publish stable IP whitelists, so IP validation is skipped.
// Rate limiting is applied instead to mitigate abuse.
const PROVIDER_IPS: Record<string, string[]> = {
  // LiqPay IPs - https://www.liqpay.ua/documentation/en/api/callback
  liqpay: [], // LiqPay doesn't publish IPs, skip validation
  // Monobank IPs
  monobank: [], // Monobank doesn't publish IPs, skip validation
  // WayForPay IPs
  wayforpay: [], // WayForPay doesn't publish IPs, skip validation
};

/**
 * Validate whether an IP is allowed for a given provider.
 * Currently all providers have empty allow-lists, so this always returns true.
 * When a provider publishes their IP ranges, add them above and this will enforce them.
 */
export function isIpAllowed(provider: string, ip: string): boolean {
  const allowedIps = PROVIDER_IPS[provider];
  if (!allowedIps || allowedIps.length === 0) return true;
  return allowedIps.includes(ip);
}

/**
 * Rate limit webhooks per provider per IP.
 * Max 100 webhooks per minute per IP per provider.
 */
export async function checkWebhookRateLimit(provider: string, ip: string): Promise<boolean> {
  const { redis } = await import('@/lib/redis');
  const key = `webhook_rl:${provider}:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);
  return count <= 100;
}
