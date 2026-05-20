import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({
  withRole: (..._roles: string[]) => (handler: Function) =>
    (req: unknown, ctx?: Record<string, unknown>) =>
      handler(req, { user: { id: 'test-admin', email: 'admin@test.com', role: 'admin' }, ...(ctx || {}) }),
}));
vi.mock('@/services/audit', () => ({ logAudit: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    marketplaceMessage: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

const mockFindMany = vi.mocked(prisma.marketplaceMessage.findMany);
const mockCount = vi.mocked(prisma.marketplaceMessage.count);

function makeRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    externalThreadId: 't1',
    platform: 'olx',
    buyerName: 'Buyer',
    text: 'hello',
    listingTitle: null,
    externalListingId: null,
    receivedAt: new Date('2026-01-01T00:00:00Z'),
    isRead: false,
    firstRespondedAt: null,
    assignee: null,
    ...over,
  } as any;
}

describe('GET /api/v1/admin/marketplaces/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCount.mockResolvedValue(0);
  });

  it('filters by channel via where.platform when channel param given', async () => {
    mockFindMany.mockResolvedValue([makeRow()] as any);

    const req = new NextRequest('http://localhost/api/v1/admin/marketplaces/messages?channel=olx');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].marketplace).toBe('olx');
    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany.mock.calls[0][0]).toMatchObject({ where: { platform: 'olx' } });
  });

  it('returns all messages with no platform filter when no channel specified', async () => {
    mockFindMany.mockResolvedValue([makeRow({ platform: 'rozetka' }), makeRow({ id: 2, platform: 'prom' })] as any);

    const req = new NextRequest('http://localhost/api/v1/admin/marketplaces/messages');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(2);
    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany.mock.calls[0][0]?.where).toEqual({});
  });

  it('returns 500 on error', async () => {
    mockFindMany.mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost/api/v1/admin/marketplaces/messages?channel=olx');
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});
