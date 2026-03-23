import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/services/publication', () => ({ syncPublicationAnalytics: vi.fn() }));

import { POST } from './route';
import { syncPublicationAnalytics } from '@/services/publication';

const mockSync = vi.mocked(syncPublicationAnalytics);

describe('POST /api/v1/admin/publications/[id]/analytics', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('syncs analytics for publication', async () => {
    const results = { views: 100, clicks: 50 };
    mockSync.mockResolvedValue(results as any);

    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual(results);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    mockSync.mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});
