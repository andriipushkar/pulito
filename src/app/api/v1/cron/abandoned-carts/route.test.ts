import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/services/jobs/cart-abandonment', () => ({ processAbandonedCarts: vi.fn() }));

import { POST } from './route';
import { processAbandonedCarts } from '@/services/jobs/cart-abandonment';

describe('POST /api/v1/cron/abandoned-carts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 without valid authorization', async () => {
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong token', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer wrong-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('processes abandoned carts on success', async () => {
    vi.mocked(processAbandonedCarts).mockResolvedValue({ notified: 5 } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(processAbandonedCarts).toHaveBeenCalledWith(24);
  });

  it('returns 500 on error', async () => {
    vi.mocked(processAbandonedCarts).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
