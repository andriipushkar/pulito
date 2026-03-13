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
