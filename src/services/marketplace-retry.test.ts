import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  fetchMarketplace,
  fetchWithMarketplaceRetry,
  withMarketplaceRetry,
} from './marketplace-retry';

beforeEach(() => vi.clearAllMocks());

describe('withMarketplaceRetry', () => {
  it('returns on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const res = await withMarketplaceRetry(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(res).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 and eventually succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('HTTP 429: Too Many Requests'))
      .mockResolvedValue('ok');
    const res = await withMarketplaceRetry(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(res).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on 503 errors', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('HTTP 503: Service Unavailable'))
      .mockResolvedValue('ok');
    const res = await withMarketplaceRetry(fn, { maxRetries: 2, baseDelayMs: 1 });
    expect(res).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on network-style errors', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValue('ok');
    const res = await withMarketplaceRetry(fn, { maxRetries: 2, baseDelayMs: 1 });
    expect(res).toBe('ok');
  });

  it('does NOT retry on generic "Network error" message', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Network error'));
    await expect(
      withMarketplaceRetry(fn, { maxRetries: 2, baseDelayMs: 1 }),
    ).rejects.toThrow('Network error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on 401', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('HTTP 401: Unauthorized'));
    await expect(
      withMarketplaceRetry(fn, { maxRetries: 3, baseDelayMs: 1 }),
    ).rejects.toThrow('401');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on validation errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Invalid title length'));
    await expect(
      withMarketplaceRetry(fn, { maxRetries: 3, baseDelayMs: 1 }),
    ).rejects.toThrow('Invalid title length');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxRetries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('HTTP 429'));
    await expect(
      withMarketplaceRetry(fn, { maxRetries: 2, baseDelayMs: 1 }),
    ).rejects.toThrow('429');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});

describe('fetchMarketplace', () => {
  it('throws on 429', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 429, statusText: 'Too Many' }));
    await expect(fetchMarketplace('http://x', {})).rejects.toThrow('429');
  });

  it('throws on 500', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 502, statusText: 'Bad Gateway' }));
    await expect(fetchMarketplace('http://x', {})).rejects.toThrow('502');
  });

  it('returns 400 responses to caller (no retry)', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 400, statusText: 'Bad Request' }));
    const res = await fetchMarketplace('http://x', {});
    expect(res.status).toBe(400);
  });

  it('returns 2xx responses to caller', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const res = await fetchMarketplace('http://x', {});
    expect(res.status).toBe(200);
  });
});

describe('fetchWithMarketplaceRetry', () => {
  it('retries 429 once then succeeds', async () => {
    let calls = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      calls++;
      if (calls === 1) return Promise.resolve(new Response(null, { status: 429 }));
      return Promise.resolve(new Response(null, { status: 200 }));
    });
    const res = await fetchWithMarketplaceRetry('http://x', {}, { maxRetries: 2, baseDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(calls).toBe(2);
  });
});
