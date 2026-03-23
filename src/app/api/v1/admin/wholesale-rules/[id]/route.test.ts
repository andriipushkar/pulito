import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    wholesaleRule: {
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { PUT, DELETE } from './route';
import { prisma } from '@/lib/prisma';

describe('PUT /api/v1/admin/wholesale-rules/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates a wholesale rule', async () => {
    const rule = { id: 1, ruleType: 'markup', productId: null, product: null, value: 20, isActive: true, createdAt: '2024-01-01' };
    vi.mocked(prisma.wholesaleRule.update).mockResolvedValue(rule as any);

    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 20 }),
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.value).toBe(20);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 20 }),
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.wholesaleRule.update).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 20 }),
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/wholesale-rules/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes a wholesale rule', async () => {
    vi.mocked(prisma.wholesaleRule.delete).mockResolvedValue({} as any);

    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.deleted).toBe(true);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.wholesaleRule.delete).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});
