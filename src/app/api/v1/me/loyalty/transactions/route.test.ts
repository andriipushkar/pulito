import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/loyalty', () => ({
  getTransactionHistory: vi.fn(),
}));

vi.mock('@/validators/loyalty', () => ({
  loyaltyTransactionFilterSchema: { safeParse: vi.fn() },
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET } from './route';
import { getTransactionHistory } from '@/services/loyalty';
import { loyaltyTransactionFilterSchema } from '@/validators/loyalty';

const mockGetHistory = getTransactionHistory as ReturnType<typeof vi.fn>;
const mockSafeParse = loyaltyTransactionFilterSchema.safeParse as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('GET /api/v1/me/loyalty/transactions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns transaction history', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { page: 1, limit: 10 } });
    mockGetHistory.mockResolvedValue({ items: [{ id: 1 }], total: 1 });
    const req = new NextRequest('http://localhost/api/v1/me/loyalty/transactions?page=1&limit=10');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 on validation error', async () => {
    mockSafeParse.mockReturnValue({ success: false, error: { issues: [{ message: 'bad' }] } });
    const req = new NextRequest('http://localhost/api/v1/me/loyalty/transactions');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on server error', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { page: 1, limit: 10 } });
    mockGetHistory.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/loyalty/transactions');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
