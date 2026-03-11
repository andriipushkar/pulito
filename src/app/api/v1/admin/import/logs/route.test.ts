import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/import', () => ({ getImportLogs: vi.fn() }));

import { GET } from './route';
import { getImportLogs } from '@/services/import';

describe('GET /api/v1/admin/import/logs', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns import logs on success', async () => {
    vi.mocked(getImportLogs).mockResolvedValue({ logs: [], total: 0 });
    const req = new NextRequest('http://localhost/api/v1/admin/import/logs?page=1&limit=20');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getImportLogs).mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/admin/import/logs');
    const res = await GET(req as any);
    expect(res.status).toBe(500);
  });
});
