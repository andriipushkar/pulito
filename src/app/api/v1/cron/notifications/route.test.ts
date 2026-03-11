import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/services/notification-queue', () => ({ processNotificationQueue: vi.fn() }));
vi.mock('@/services/notification', () => ({ cleanupExpiredNotifications: vi.fn() }));

import { POST } from './route';
import { processNotificationQueue } from '@/services/notification-queue';
import { cleanupExpiredNotifications } from '@/services/notification';

describe('POST /api/v1/cron/notifications', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('processes notifications on success', async () => {
    vi.mocked(processNotificationQueue).mockResolvedValue({ processed: 5 });
    vi.mocked(cleanupExpiredNotifications).mockResolvedValue({ deleted: 2 });
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(processNotificationQueue).mockRejectedValue(new Error('fail'));
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
