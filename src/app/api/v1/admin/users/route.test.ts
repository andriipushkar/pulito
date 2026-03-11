import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/user', () => ({ getAllUsers: vi.fn() }));

import { GET } from './route';
import { getAllUsers } from '@/services/user';

describe('GET /api/v1/admin/users', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns users on success', async () => {
    vi.mocked(getAllUsers).mockResolvedValue({ users: [], total: 0 });
    const req = new NextRequest('http://localhost/api/v1/admin/users?page=1&limit=20');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('passes filter params to service', async () => {
    vi.mocked(getAllUsers).mockResolvedValue({ users: [], total: 0 });
    const req = new NextRequest('http://localhost/api/v1/admin/users?page=2&limit=10&role=admin&wholesaleStatus=pending&search=test');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    expect(vi.mocked(getAllUsers)).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 10, role: 'admin', wholesaleStatus: 'pending', search: 'test' })
    );
  });

  it('returns 500 on error', async () => {
    vi.mocked(getAllUsers).mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/admin/users');
    const res = await GET(req as any);
    expect(res.status).toBe(500);
  });

  it('uses default values when no params provided', async () => {
    vi.mocked(getAllUsers).mockResolvedValue({ users: [], total: 0 });
    const req = new NextRequest('http://localhost/api/v1/admin/users');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    expect(vi.mocked(getAllUsers)).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20, role: undefined, wholesaleStatus: undefined, search: undefined })
    );
  });
});
