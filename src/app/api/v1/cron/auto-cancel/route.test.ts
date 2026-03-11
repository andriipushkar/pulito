import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/services/jobs/auto-cancel-orders', () => ({ autoCancelStaleOrders: vi.fn() }));

import { POST } from './route';
import { autoCancelStaleOrders } from '@/services/jobs/auto-cancel-orders';

describe('POST src/app/api/v1/cron/auto-cancel', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns result on success with valid auth', async () => {
    vi.mocked(autoCancelStaleOrders).mockResolvedValue(2);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(autoCancelStaleOrders).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });

  it('returns 401 without valid authorization', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });
});
