import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    publication: { findMany: vi.fn() },
  },
}));
vi.mock('@/services/publication', () => ({ publishNow: vi.fn() }));

import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { publishNow } from '@/services/publication';

describe('POST /api/v1/cron/publish-scheduled', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 without valid authorization', async () => {
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('publishes due scheduled publications', async () => {
    vi.mocked(prisma.publication.findMany).mockResolvedValue([
      { id: 1 },
      { id: 2 },
    ] as any);
    vi.mocked(publishNow).mockResolvedValue(undefined as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.processed).toBe(2);
    expect(data.data.results).toEqual([
      { id: 1, status: 'published' },
      { id: 2, status: 'published' },
    ]);
  });

  it('handles individual publish failures', async () => {
    vi.mocked(prisma.publication.findMany).mockResolvedValue([{ id: 1 }, { id: 2 }] as any);
    vi.mocked(publishNow)
      .mockResolvedValueOnce(undefined as any)
      .mockRejectedValueOnce(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.results).toEqual([
      { id: 1, status: 'published' },
      { id: 2, status: 'failed' },
    ]);
  });

  it('returns empty results when nothing is due', async () => {
    vi.mocked(prisma.publication.findMany).mockResolvedValue([]);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.processed).toBe(0);
  });
});
