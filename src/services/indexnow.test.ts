import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/config/env', () => ({
  env: { NODE_ENV: 'production', APP_URL: 'https://pulito.trade', INDEXNOW_KEY: 'testkey123' },
}));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { submitToIndexNow, submitProductsToIndexNow } from './indexnow';

describe('indexnow', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = fetchMock as never;
  });
  afterEach(() => vi.restoreAllMocks());

  it('POSTs host/key/keyLocation/urlList and returns true on 200', async () => {
    fetchMock.mockResolvedValue({ status: 200 });
    const ok = await submitToIndexNow(['https://pulito.trade/product/a']);
    expect(ok).toBe(true);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.indexnow.org/indexnow');
    const body = JSON.parse(opts.body);
    expect(body.host).toBe('pulito.trade');
    expect(body.key).toBe('testkey123');
    expect(body.keyLocation).toBe('https://pulito.trade/indexnow-key.txt');
    expect(body.urlList).toEqual(['https://pulito.trade/product/a']);
  });

  it('treats 202 as success', async () => {
    fetchMock.mockResolvedValue({ status: 202 });
    expect(await submitToIndexNow(['https://pulito.trade/x'])).toBe(true);
  });

  it('returns false (no throw) on non-2xx', async () => {
    fetchMock.mockResolvedValue({ status: 403 });
    expect(await submitToIndexNow(['https://pulito.trade/x'])).toBe(false);
  });

  it('returns false and swallows fetch errors', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    expect(await submitToIndexNow(['https://pulito.trade/x'])).toBe(false);
  });

  it('skips when no absolute URLs given (no fetch)', async () => {
    expect(await submitToIndexNow(['/relative'])).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('dedupes and builds product URLs from slugs', async () => {
    fetchMock.mockResolvedValue({ status: 200 });
    await submitProductsToIndexNow(['slug-a', 'slug-a', 'slug-b']);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.urlList).toEqual([
      'https://pulito.trade/product/slug-a',
      'https://pulito.trade/product/slug-b',
    ]);
  });
});
