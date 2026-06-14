import { describe, it, expect, vi, afterEach } from 'vitest';
import { normalizeFeedUrl, fetchSupplierFeedBuffer, SupplierChannelError } from './feed-source';

describe('normalizeFeedUrl (Google Sheets)', () => {
  it('rewrites an edit link to a CSV export URL, keeping the gid', () => {
    expect(normalizeFeedUrl('https://docs.google.com/spreadsheets/d/ABC123_xy/edit#gid=42')).toBe(
      'https://docs.google.com/spreadsheets/d/ABC123_xy/export?format=csv&gid=42',
    );
  });

  it('rewrites a bare /edit link without a gid', () => {
    expect(normalizeFeedUrl('https://docs.google.com/spreadsheets/d/ABC123/edit')).toBe(
      'https://docs.google.com/spreadsheets/d/ABC123/export?format=csv',
    );
  });

  it('leaves an already-export Sheets URL untouched', () => {
    const u = 'https://docs.google.com/spreadsheets/d/ABC/export?format=csv&gid=7';
    expect(normalizeFeedUrl(u)).toBe(u);
  });

  it('passes non-Sheets URLs through unchanged', () => {
    const u = 'https://supplier.example/price.yml';
    expect(normalizeFeedUrl(u)).toBe(u);
  });
});

describe('fetchSupplierFeedBuffer (streaming size guard)', () => {
  const channel = {
    feedUrl: 'https://supplier.example/price.yml',
    authType: 'none' as const,
    authUsername: null,
    authPassword: null,
    authToken: null,
  };

  const streamResponse = (chunks: Uint8Array[], headers: Record<string, string> = {}) => {
    let i = 0;
    const body = {
      getReader: () => ({
        read: async () =>
          i < chunks.length
            ? { done: false, value: chunks[i++] }
            : { done: true, value: undefined },
        cancel: async () => {},
      }),
    };
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(headers),
      body,
    } as unknown as Response;
  };

  afterEach(() => vi.restoreAllMocks());

  it('streams a normal feed into a Buffer', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      streamResponse([new TextEncoder().encode('<yml/>')]),
    );
    const buf = await fetchSupplierFeedBuffer(channel);
    expect(buf.toString('utf8')).toBe('<yml/>');
  });

  it('aborts with 413 when the streamed body exceeds 50 MB', async () => {
    const big = new Uint8Array(20 * 1024 * 1024); // 20 MB chunks → 60 MB total
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(streamResponse([big, big, big]));
    await expect(fetchSupplierFeedBuffer(channel)).rejects.toMatchObject({ statusCode: 413 });
  });
});
