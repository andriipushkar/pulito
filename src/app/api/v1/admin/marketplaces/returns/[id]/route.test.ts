import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    marketplaceReturn: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { PATCH } from './route';
import { prisma } from '@/lib/prisma';

describe('PATCH /api/v1/admin/marketplaces/returns/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates return status', async () => {
    const updated = { id: 1, status: 'approved' };
    vi.mocked(prisma.marketplaceReturn.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(prisma.marketplaceReturn.update).mockResolvedValue(updated as any);

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual(updated);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid status', async () => {
    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'invalid' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(400);
  });

  it('returns 404 when return not found', async () => {
    vi.mocked(prisma.marketplaceReturn.findUnique).mockResolvedValue(null);

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: '999' }) });

    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.marketplaceReturn.findUnique).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});
