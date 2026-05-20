/**
 * Shared retry primitives for marketplace API clients.
 *
 * Exponential backoff with jitter, retries only on 429 (rate limit) and
 * 5xx (server error) responses. Network errors are also retried. Anything
 * else throws on the first attempt — auth errors, validation errors,
 * 4xx user errors shouldn't burn retries.
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

export async function withMarketplaceRetry<T>(
  fn: () => Promise<T>,
  { maxRetries = 3, baseDelayMs = 1000 }: RetryOptions = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : '';
      const isRetryable =
        /\b429\b/.test(msg) ||
        /\b5\d\d\b/.test(msg) ||
        /\b(?:ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED)\b/i.test(msg) ||
        /(?:^|\s)timeout(?:$|\s)/i.test(msg);
      if (!isRetryable || attempt === maxRetries) break;
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

/**
 * Calls fetch, throws on 429/5xx so withMarketplaceRetry can catch and retry.
 * Successful (<400) and 4xx (other than 429) responses are returned as-is so
 * callers can inspect the body for endpoint-specific error shape.
 *
 * When `platform` is provided, the marketplace's X-RateLimit-* headers are
 * snapshotted into siteSetting so the admin UI can display remaining quota.
 */
export async function fetchMarketplace(
  url: string,
  init: RequestInit,
  platform?: 'olx' | 'rozetka' | 'prom' | 'epicentrk',
): Promise<Response> {
  const res = await fetch(url, init);
  if (platform) {
    try {
      const { recordQuotaFromHeaders } = await import('@/services/marketplace-quota');
      void recordQuotaFromHeaders(platform, res.headers);
    } catch {
      // Quota tracking is best-effort
    }
  }
  if (res.status === 429 || res.status >= 500) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res;
}

/**
 * Convenience wrapper: fetch with both retry-on-429/5xx and exponential backoff.
 */
export async function fetchWithMarketplaceRetry(
  url: string,
  init: RequestInit,
  opts?: RetryOptions,
): Promise<Response> {
  return withMarketplaceRetry(() => fetchMarketplace(url, init), opts);
}
