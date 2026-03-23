import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/services/marketplace-sync', () => ({ importOrdersFromMarketplace: vi.fn() }));

import { POST } from './route';
import { importOrdersFromMarketplace } from '@/services/marketplace-sync';

describe('POST /api/v1/cron/sync-marketplace-orders', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 without valid authorization', async () => {
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('imports orders from all marketplaces', async () => {
    vi.mocked(importOrdersFromMarketplace).mockResolvedValue({ imported: 5, skipped: 1, failed: 0 });
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(importOrdersFromMarketplace).toHaveBeenCalledWith('rozetka');
    expect(importOrdersFromMarketplace).toHaveBeenCalledWith('prom');
  });

  it('handles individual platform failure', async () => {
    vi.mocked(importOrdersFromMarketplace)
      .mockResolvedValueOnce({ imported: 5, skipped: 0, failed: 0 })
      .mockRejectedValueOnce(new Error('prom error'));
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.rozetka.imported).toBe(5);
    expect(data.data.prom.failed).toBe(-1);
  });

  it('returns 200 even when all platforms fail individually', async () => {
    vi.mocked(importOrdersFromMarketplace).mockRejectedValue(new Error('sync'));
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.rozetka.failed).toBe(-1);
    expect(data.data.prom.failed).toBe(-1);
  });
});
