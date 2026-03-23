import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/services/typesense', () => ({
  indexAllProducts: vi.fn(),
  isTypesenseAvailable: vi.fn(),
}));

import { POST } from './route';
import { indexAllProducts, isTypesenseAvailable } from '@/services/typesense';

describe('POST /api/v1/cron/reindex-products', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 without valid authorization', async () => {
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('reindexes products when Typesense is available', async () => {
    vi.mocked(isTypesenseAvailable).mockResolvedValue(true);
    vi.mocked(indexAllProducts).mockResolvedValue({ indexed: 200 } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 503 when Typesense is unavailable', async () => {
    vi.mocked(isTypesenseAvailable).mockResolvedValue(false);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(503);
  });

  it('returns 500 on error', async () => {
    vi.mocked(isTypesenseAvailable).mockResolvedValue(true);
    vi.mocked(indexAllProducts).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
