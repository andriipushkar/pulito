import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => (...args: unknown[]) => handler(...args),
  withOptionalAuth: (handler: Function) => (...args: unknown[]) => handler(...args),
  withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    wholesaleRule: { findMany: vi.fn() },
  },
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';

const mocked = vi.mocked(prisma.wholesaleRule.findMany);

describe('GET /api/v1/wholesale-rules', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns rules for wholesaler', async () => {
    mocked.mockResolvedValue([{ id: 1, ruleType: 'discount', productId: null, product: null, value: 10, isActive: true }] as never);
    const req = new NextRequest('http://localhost/api/v1/wholesale-rules');
    const res = await GET(req, { user: { id: 1, role: 'wholesaler' }, params: Promise.resolve({}) } as any);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 403 for non-wholesaler', async () => {
    const req = new NextRequest('http://localhost/api/v1/wholesale-rules');
    const res = await GET(req, { user: { id: 1, role: 'customer' }, params: Promise.resolve({}) } as any);
    expect(res.status).toBe(403);
  });

  it('returns 500 on error', async () => {
    mocked.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/wholesale-rules');
    const res = await GET(req, { user: { id: 1, role: 'wholesaler' }, params: Promise.resolve({}) } as any);
    expect(res.status).toBe(500);
  });
});
