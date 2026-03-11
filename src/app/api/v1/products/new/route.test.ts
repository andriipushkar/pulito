import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/services/product', () => ({
  getNewProducts: vi.fn(),
}));

import { GET } from './route';
import { getNewProducts } from '@/services/product';

const mocked = vi.mocked(getNewProducts);

describe('GET /api/v1/products/new', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns new products on success', async () => {
    mocked.mockResolvedValue([{ id: 1 }] as never);
    const req = new NextRequest('http://localhost/api/v1/products/new?limit=5');
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 500 on service error', async () => {
    mocked.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/products/new');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
