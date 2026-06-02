import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    APP_URL: 'https://test.com',
    CRON_SECRET: 'test-cron-secret',
    APP_SECRET: 'test-app-secret',
  },
}));
vi.mock('@/services/jobs/process-subscriptions', () => ({ processSubscriptionOrders: vi.fn() }));

import { POST } from './route';
import { processSubscriptionOrders } from '@/services/jobs/process-subscriptions';

describe('POST /api/v1/cron/process-subscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without valid authorization', async () => {
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('processes subscriptions on success', async () => {
    vi.mocked(processSubscriptionOrders).mockResolvedValue({
      processed: 10,
      failed: 1,
      skipped: 2,
    });
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-cron-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.processed).toBe(10);
    expect(data.data.failed).toBe(1);
  });

  it('returns 500 on error', async () => {
    vi.mocked(processSubscriptionOrders).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-cron-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
