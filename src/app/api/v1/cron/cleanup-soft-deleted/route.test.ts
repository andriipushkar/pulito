import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/services/jobs/cleanup-soft-deleted', () => ({ cleanupSoftDeleted: vi.fn() }));

import { POST } from './route';
import { cleanupSoftDeleted } from '@/services/jobs/cleanup-soft-deleted';

describe('POST /api/v1/cron/cleanup-soft-deleted', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 without valid authorization', async () => {
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('cleans up soft-deleted records on success', async () => {
    vi.mocked(cleanupSoftDeleted).mockResolvedValue({ products: 5, categories: 2 });
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.products).toBe(5);
    expect(data.data.categories).toBe(2);
  });

  it('returns 500 on error', async () => {
    vi.mocked(cleanupSoftDeleted).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
