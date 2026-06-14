import type { SupplierChannel } from '@/../generated/prisma';
import { decrypt, isEncrypted } from '@/lib/encryption';
import { isSafeOutboundUrl } from '@/utils/safe-url';

/**
 * Error raised while talking to a supplier feed. `statusCode` is the HTTP
 * status an API route should surface. Defined here (not in supplier-channel.ts)
 * so both the legacy catalog importer and the new consignment sync engine throw
 * the same type — routes do `instanceof SupplierChannelError` regardless of
 * which path produced the error.
 */
export class SupplierChannelError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'SupplierChannelError';
  }
}

const FETCH_TIMEOUT_MS = 60_000; // 60 seconds — supplier feeds can be large
const MAX_FEED_SIZE = 50 * 1024 * 1024; // 50 MB

/** Auth/SSRF/timeout settings a fetch needs — the subset of a channel the
 *  fetcher actually reads, so callers can pass a partial record (e.g. a cron
 *  `select`) without loading the whole row. */
export type FeedSource = Pick<
  SupplierChannel,
  'feedUrl' | 'authType' | 'authUsername' | 'authPassword' | 'authToken'
>;

/**
 * Rewrite a Google Sheets share/edit link into a direct CSV export URL so an
 * admin can paste the link they see in the browser and pick format `csv`.
 * `https://docs.google.com/spreadsheets/d/<ID>/edit#gid=<GID>` →
 * `https://docs.google.com/spreadsheets/d/<ID>/export?format=csv&gid=<GID>`.
 * Non-Sheets URLs (and already-export URLs) pass through untouched.
 */
export function normalizeFeedUrl(url: string): string {
  const m = url.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!m) return url;
  if (/\/export\b/.test(url) || /[?&]format=/.test(url)) return url; // already a data URL
  const gid = url.match(/[#&?]gid=(\d+)/)?.[1];
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
}

/**
 * Fetch a supplier feed URL into a Buffer, honouring the channel's auth
 * (basic / bearer) and refusing private/loopback targets (SSRF) plus oversized
 * payloads. This is the single safe entry point for pulling any supplier feed —
 * both the legacy catalog import and the consignment price/stock sync use it.
 *
 * Caller is expected to be admin/manager/cron — channels live in the
 * integrations area, never on the storefront.
 */
export async function fetchSupplierFeedBuffer(channel: FeedSource): Promise<Buffer> {
  const feedUrl = normalizeFeedUrl(channel.feedUrl);
  // SSRF guard: even though POST/PATCH validate feedUrl, a record might predate
  // the validator. Refuse to fetch private/loopback addresses.
  if (!isSafeOutboundUrl(feedUrl, { protocols: ['http:', 'https:'] })) {
    throw new SupplierChannelError('URL фіду вказує на приватну/локальну адресу — заборонено', 400);
  }

  const headers: Record<string, string> = {
    'User-Agent': 'PulitoTrade-Importer/1.0',
  };
  if (channel.authType === 'basic' && channel.authUsername && channel.authPassword) {
    const pwd = isEncrypted(channel.authPassword)
      ? decrypt(channel.authPassword)
      : channel.authPassword;
    const token = Buffer.from(`${channel.authUsername}:${pwd}`).toString('base64');
    headers['Authorization'] = `Basic ${token}`;
  } else if (channel.authType === 'bearer' && channel.authToken) {
    const tok = isEncrypted(channel.authToken) ? decrypt(channel.authToken) : channel.authToken;
    headers['Authorization'] = `Bearer ${tok}`;
  }

  const controller = new AbortController();
  // The timeout covers the WHOLE transfer (headers + body), not just the
  // initial response — a slow supplier dribbling bytes shouldn't pin a worker.
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(feedUrl, {
        headers,
        signal: controller.signal,
        redirect: 'error', // refuse redirect-based SSRF to internal targets
      });
    } catch (err) {
      throw new SupplierChannelError(
        `Не вдалося завантажити фід: ${err instanceof Error ? err.message : 'fetch error'}`,
        502,
      );
    }

    if (!response.ok) {
      throw new SupplierChannelError(
        `Постачальник повернув ${response.status} ${response.statusText}`,
        502,
      );
    }

    // content-length is a cheap early reject, but it's optional and spoofable
    // (chunked transfer omits it), so the real guard is the streaming counter.
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_FEED_SIZE) {
      throw new SupplierChannelError(
        `Фід занадто великий: ${Math.round(contentLength / 1024 / 1024)} MB (макс. 50)`,
        413,
      );
    }

    // Stream the body, aborting the moment accumulated bytes exceed the cap, so
    // a huge or zip-bomb feed can't be fully buffered into memory and OOM the
    // process before a post-hoc size check could fire.
    const reader = response.body?.getReader();
    if (!reader) {
      const arrayBuf = await response.arrayBuffer();
      if (arrayBuf.byteLength > MAX_FEED_SIZE) {
        throw new SupplierChannelError('Фід занадто великий (макс. 50 MB)', 413);
      }
      return Buffer.from(arrayBuf);
    }

    const chunks: Buffer[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_FEED_SIZE) {
        await reader.cancel().catch(() => {});
        controller.abort();
        throw new SupplierChannelError('Фід занадто великий (макс. 50 MB)', 413);
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total);
  } finally {
    clearTimeout(timeout);
  }
}
