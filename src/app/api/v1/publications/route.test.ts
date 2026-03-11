import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    publication: { findMany: vi.fn() },
  },
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';

const mockedFindMany = vi.mocked(prisma.publication.findMany);

describe('GET /api/v1/publications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns publications on success', async () => {
    mockedFindMany
      .mockResolvedValueOnce([{ id: 1, channels: ['site'] }] as never)
      .mockResolvedValueOnce([{ id: 1, title: 'Pub' }] as never);
    const req = new NextRequest('http://localhost/api/v1/publications?page=1&limit=10');
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 500 on error', async () => {
    mockedFindMany.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/publications');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it('filters out publications without site channel', async () => {
    mockedFindMany
      .mockResolvedValueOnce([
        { id: 1, channels: ['site'] },
        { id: 2, channels: ['telegram'] },
        { id: 3, channels: ['site', 'telegram'] },
      ] as never)
      .mockResolvedValueOnce([
        { id: 1, title: 'Pub1' },
        { id: 3, title: 'Pub3' },
      ] as never);
    const req = new NextRequest('http://localhost/api/v1/publications?page=1&limit=10');
    const res = await GET(req);
    const json = await res.json();
    expect(json.data.total).toBe(2);
  });

  it('returns empty list when no publications have site channel', async () => {
    mockedFindMany
      .mockResolvedValueOnce([
        { id: 1, channels: ['telegram'] },
      ] as never);
    const req = new NextRequest('http://localhost/api/v1/publications?page=2&limit=10');
    const res = await GET(req);
    const json = await res.json();
    expect(json.data.publications).toEqual([]);
    expect(json.data.total).toBe(0);
  });

  it('handles publications with null or non-array channels', async () => {
    mockedFindMany
      .mockResolvedValueOnce([
        { id: 1, channels: null },
        { id: 2, channels: 'not-array' },
        { id: 3, channels: ['site'] },
      ] as never)
      .mockResolvedValueOnce([
        { id: 3, title: 'Pub3' },
      ] as never);
    const req = new NextRequest('http://localhost/api/v1/publications');
    const res = await GET(req);
    const json = await res.json();
    expect(json.data.total).toBe(1);
  });
});
