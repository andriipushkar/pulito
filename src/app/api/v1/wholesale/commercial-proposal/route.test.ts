import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: (..._roles: string[]) => (handler: Function) => handler,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('@/services/b2b', () => ({
  resolveBulkOrder: vi.fn(),
}));

vi.mock('@/services/commercial-proposal', () => ({
  generateCommercialProposal: vi.fn(),
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { resolveBulkOrder } from '@/services/b2b';
import { generateCommercialProposal } from '@/services/commercial-proposal';

const mockFindUser = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const mockResolveBulk = resolveBulkOrder as ReturnType<typeof vi.fn>;
const mockGenProposal = generateCommercialProposal as ReturnType<typeof vi.fn>;

const authCtx = { user: { id: 1, email: 'test@test.com', role: 'wholesaler' } };

function makeReq(body: any) {
  return new NextRequest('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/wholesale/commercial-proposal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 on invalid data', async () => {
    const res = await POST(makeReq({ items: [] }), authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 403 for non-wholesaler users', async () => {
    mockFindUser.mockResolvedValue({ role: 'customer', wholesaleGroup: null, fullName: 'Test', companyName: null });
    const res = await POST(makeReq({ items: [{ code: 'P1', quantity: 10 }] }), authCtx as any);
    expect(res.status).toBe(403);
  });

  it('returns 404 when no products found', async () => {
    mockFindUser.mockResolvedValue({ role: 'wholesaler', wholesaleGroup: 'A', fullName: 'Test', companyName: 'Co' });
    mockResolveBulk.mockResolvedValue({ items: [], totalAmount: 0 });
    const res = await POST(makeReq({ items: [{ code: 'P1', quantity: 10 }] }), authCtx as any);
    expect(res.status).toBe(404);
  });

  it('generates proposal on success', async () => {
    mockFindUser.mockResolvedValue({ role: 'wholesaler', wholesaleGroup: 'A', fullName: 'Test', companyName: 'Co' });
    mockResolveBulk.mockResolvedValue({
      items: [{ code: 'P1', name: 'Product 1', quantity: 10, price: 100, total: 1000 }],
      totalAmount: 1000,
    });
    mockGenProposal.mockResolvedValue('https://cdn.example.com/proposal.pdf');
    const res = await POST(makeReq({ items: [{ code: 'P1', quantity: 10 }] }), authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.url).toBe('https://cdn.example.com/proposal.pdf');
  });

  it('returns 500 on error', async () => {
    mockFindUser.mockRejectedValue(new Error('fail'));
    const res = await POST(makeReq({ items: [{ code: 'P1', quantity: 10 }] }), authCtx as any);
    expect(res.status).toBe(500);
  });
});
