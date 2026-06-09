import { env } from '@/config/env';
import { logger } from '@/lib/logger';

// IndexNow (https://www.indexnow.org) — a single ping notifies all
// participating engines (Bing, Yandex, Seznam, Naver). Google does NOT
// participate: it dropped the sitemap-ping endpoint and limits its Indexing
// API to JobPosting/BroadcastEvent, so for Google we rely on sitemap lastmod
// + Search Console. This still earns faster discovery on the other engines.

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

// Where the key-verification file is served. The spec lets the key file live
// anywhere on the host as long as `keyLocation` points at it, so we use one
// fixed path instead of the dynamic `/{key}.txt` (awkward to route in Next).
export const INDEXNOW_KEY_PATH = '/indexnow-key.txt';

// Per the spec a single submission may carry up to 10 000 URLs.
const MAX_URLS_PER_SUBMISSION = 10_000;

/** Absolute base URL without a trailing slash. */
function baseUrl(): string {
  return env.APP_URL.replace(/\/$/, '');
}

/** The bare host (no scheme) — IndexNow's `host` field. */
function host(): string {
  return baseUrl().replace(/^https?:\/\//, '');
}

/**
 * Notify IndexNow engines that the given absolute URLs changed. Fire-and-forget:
 * never throws, returns false when skipped/failed so callers can ignore it.
 * Skipped in non-production and when no key is configured (local/dev/CI).
 */
export async function submitToIndexNow(urls: string[]): Promise<boolean> {
  if (env.NODE_ENV !== 'production' || !env.INDEXNOW_KEY) return false;

  const urlList = Array.from(new Set(urls.filter((u) => u.startsWith('http')))).slice(
    0,
    MAX_URLS_PER_SUBMISSION,
  );
  if (urlList.length === 0) return false;

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: host(),
        key: env.INDEXNOW_KEY,
        keyLocation: `${baseUrl()}${INDEXNOW_KEY_PATH}`,
        urlList,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    // 200 (accepted) and 202 (accepted, pending) are both success.
    if (res.status !== 200 && res.status !== 202) {
      logger.warn('IndexNow submission rejected', { status: res.status, count: urlList.length });
      return false;
    }
    return true;
  } catch (err) {
    logger.warn('IndexNow submission failed', { error: err instanceof Error ? err.message : err });
    return false;
  }
}

/** Convenience: submit one or more product detail pages by slug. */
export async function submitProductsToIndexNow(slugs: string[]): Promise<boolean> {
  const urls = slugs.filter(Boolean).map((slug) => `${baseUrl()}/product/${slug}`);
  return submitToIndexNow(urls);
}
