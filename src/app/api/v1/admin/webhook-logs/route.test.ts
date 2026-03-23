import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/services/webhook-log', () => ({ getWebhookLogs: vi.fn() }));

import { GET } from './route';
import { getWebhookLogs } from '@/services/webhook-log';
import { NextRequest } from 'next/server';

const mockGetLogs = vi.mocked(getWebhookLogs);

describe('GET /api/v1/admin/webhook-logs', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns paginated webhook logs', async () => {
    const data = { logs: [{ id: 1, source: 'liqpay' }], total: 1 };
    mockGetLogs.mockResolvedValue(data as any);

    const req = new NextRequest('http://localhost/api/v1/admin/webhook-logs?page=1&limit=50');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual(data.logs);
  });

  it('passes source filter', async () => {
    mockGetLogs.mockResolvedValue({ logs: [], total: 0 } as any);

    const req = new NextRequest('http://localhost/api/v1/admin/webhook-logs?source=liqpay');
    const res = await GET(req);

    expect(mockGetLogs).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'liqpay' })
    );
  });

  it('returns 500 on error', async () => {
    mockGetLogs.mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost/api/v1/admin/webhook-logs');
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});
