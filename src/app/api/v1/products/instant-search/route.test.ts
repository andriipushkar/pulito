import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { GET } from './route';

describe('GET /api/v1/products/instant-search', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty data for short query', async () => {
    const req = new Request('http://localhost/api/v1/products/instant-search?q=a');
    const res = await GET(req);
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  it('returns search results from typesense', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        hits: [
          { document: { id: '1', name: 'Soap', code: 'S1', slug: 'soap', priceRetail: 50, imagePath: null, categoryName: 'Clean' } },
        ],
      }),
    });
    const req = new Request('http://localhost/api/v1/products/instant-search?q=soap');
    const res = await GET(req);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].name).toBe('Soap');
  });

  it('returns empty data on typesense error', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const req = new Request('http://localhost/api/v1/products/instant-search?q=soap');
    const res = await GET(req);
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  it('returns empty data on fetch exception', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));
    const req = new Request('http://localhost/api/v1/products/instant-search?q=soap');
    const res = await GET(req);
    const json = await res.json();
    expect(json.data).toEqual([]);
  });
});
