import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    publication: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';

const mockedFindMany = vi.mocked(prisma.publication.findMany);
const mockedCount = vi.mocked(prisma.publication.count);

describe('GET /api/v1/publications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns publications on success', async () => {
    mockedCount.mockResolvedValue(1 as never);
    mockedFindMany.mockResolvedValue([{ id: 1, title: 'Pub' }] as never);
    const req = new NextRequest('http://localhost/api/v1/publications?page=1&limit=10');
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 500 on error', async () => {
    mockedCount.mockRejectedValue(new Error('fail'));
    mockedFindMany.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/publications');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  // Channel filtering is now pushed down to Postgres via the
  // `channels @> ["site"]` (array_contains) predicate, so the route returns
  // exactly what the DB query returns — count + rows.
  it('returns site-channel publications with total from count', async () => {
    mockedCount.mockResolvedValue(2 as never);
    mockedFindMany.mockResolvedValue([
      { id: 1, title: 'Pub1' },
      { id: 3, title: 'Pub3' },
    ] as never);
    const req = new NextRequest('http://localhost/api/v1/publications?page=1&limit=10');
    const res = await GET(req);
    const json = await res.json();
    expect(json.data.total).toBe(2);
    expect(json.data.publications).toHaveLength(2);
  });

  it('returns empty list when no publications match', async () => {
    mockedCount.mockResolvedValue(0 as never);
    mockedFindMany.mockResolvedValue([] as never);
    const req = new NextRequest('http://localhost/api/v1/publications?page=2&limit=10');
    const res = await GET(req);
    const json = await res.json();
    expect(json.data.publications).toEqual([]);
    expect(json.data.total).toBe(0);
  });
});
