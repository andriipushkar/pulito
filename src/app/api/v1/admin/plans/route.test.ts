import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/services/billing', () => ({ getPlans: vi.fn() }));

import { GET } from './route';
import { getPlans } from '@/services/billing';

const mockGetPlans = vi.mocked(getPlans);

describe('GET /api/v1/admin/plans', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns plans on success', async () => {
    const plans = [{ id: 1, name: 'Basic' }, { id: 2, name: 'Pro' }];
    mockGetPlans.mockResolvedValue(plans as any);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual(plans);
  });

  it('returns 500 on error', async () => {
    mockGetPlans.mockRejectedValue(new Error('fail'));

    const res = await GET();

    expect(res.status).toBe(500);
  });
});
