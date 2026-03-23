import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/services/jobs/loyalty-streaks', () => ({ processLoyaltyStreaks: vi.fn() }));
vi.mock('@/services/jobs/loyalty-birthday', () => ({ processBirthdayBonuses: vi.fn() }));

import { POST } from './route';
import { processLoyaltyStreaks } from '@/services/jobs/loyalty-streaks';
import { processBirthdayBonuses } from '@/services/jobs/loyalty-birthday';

describe('POST /api/v1/cron/loyalty-daily', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 without valid authorization', async () => {
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('processes loyalty streaks and birthday bonuses', async () => {
    vi.mocked(processLoyaltyStreaks).mockResolvedValue({ updated: 10 } as any);
    vi.mocked(processBirthdayBonuses).mockResolvedValue({ sent: 5 } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.streaks).toEqual({ updated: 10 });
    expect(data.data.birthdays).toEqual({ sent: 5 });
  });

  it('returns 500 on error', async () => {
    vi.mocked(processLoyaltyStreaks).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
