import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/services/return-request', () => ({ getAdminReturns: vi.fn() }));

import { GET } from './route';
import { getAdminReturns } from '@/services/return-request';

const mockGetReturns = vi.mocked(getAdminReturns);

describe('GET /api/v1/admin/returns', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns paginated returns', async () => {
    const data = { returns: [{ id: 1 }], total: 1 };
    mockGetReturns.mockResolvedValue(data as any);

    const req = new Request('http://localhost/api/v1/admin/returns?page=1&limit=20');
    const res = await GET(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.returns).toEqual([{ id: 1 }]);
  });

  it('passes status filter', async () => {
    mockGetReturns.mockResolvedValue({ returns: [], total: 0 } as any);

    const req = new Request('http://localhost/api/v1/admin/returns?status=pending');
    const res = await GET(req as any);

    expect(mockGetReturns).toHaveBeenCalledWith(1, 20, 'pending');
  });

  it('returns 500 on error', async () => {
    mockGetReturns.mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost/api/v1/admin/returns');
    const res = await GET(req as any);

    expect(res.status).toBe(500);
  });
});
