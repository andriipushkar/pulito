import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/services/purchase-prediction', () => ({
  buildPredictions: vi.fn(),
  processReminders: vi.fn(),
}));

import { POST } from './route';
import { buildPredictions, processReminders } from '@/services/purchase-prediction';

describe('POST /api/v1/cron/predictions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 without valid authorization', async () => {
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('builds predictions and sends reminders', async () => {
    vi.mocked(buildPredictions).mockResolvedValue(50);
    vi.mocked(processReminders).mockResolvedValue(10);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.predictionsBuilt).toBe(50);
    expect(data.data.remindersSent).toBe(10);
  });

  it('returns 500 on error', async () => {
    vi.mocked(buildPredictions).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
