import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/jobs/cart-abandonment', () => ({ processAbandonedCarts: vi.fn() }));

import { POST } from './route';
import { processAbandonedCarts } from '@/services/jobs/cart-abandonment';

describe('POST /api/v1/admin/jobs/cart-abandonment', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('processes abandoned carts on success', async () => {
    vi.mocked(processAbandonedCarts).mockResolvedValue({ sent: 5 } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ hoursThreshold: 24 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it('handles invalid JSON body gracefully', async () => {
    vi.mocked(processAbandonedCarts).mockResolvedValue({ sent: 0 } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(vi.mocked(processAbandonedCarts)).toHaveBeenCalledWith(24);
  });

  it('uses default hours when hoursThreshold is not provided', async () => {
    vi.mocked(processAbandonedCarts).mockResolvedValue({ sent: 0 } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(vi.mocked(processAbandonedCarts)).toHaveBeenCalledWith(24);
  });

  it('returns 500 on error', async () => {
    vi.mocked(processAbandonedCarts).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
