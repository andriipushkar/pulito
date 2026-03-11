import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';

const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('GET /api/v1/me/export', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exports user data as JSON attachment', async () => {
    mockFindUnique.mockResolvedValue({
      id: 1,
      email: 'test@test.com',
      fullName: 'Test',
      phone: '+380501234567',
      companyName: null,
      edrpou: null,
      role: 'client',
      wholesaleStatus: null,
      createdAt: new Date('2024-01-01'),
      addresses: [
        { label: 'Home', city: 'Kyiv', street: 'Main St', building: '1', apartment: '10', postalCode: '01001', isDefault: true },
      ],
      orders: [
        {
          orderNumber: 'ORD-001',
          status: 'completed',
          totalAmount: 500,
          createdAt: new Date('2024-06-15'),
          items: [
            { productName: 'Product A', quantity: 2, priceAtOrder: 200, subtotal: 400 },
          ],
        },
      ],
      wishlists: [
        {
          name: 'My List',
          items: [
            { product: { name: 'Fav Product', code: 'FP1' } },
            { product: null },
          ],
        },
      ],
    });
    const req = new NextRequest('http://localhost/api/v1/me/export');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');

    const body = JSON.parse(await res.text());
    expect(body.personalData.email).toBe('test@test.com');
    expect(body.personalData.fullName).toBe('Test');
    expect(body.personalData.phone).toBe('+380501234567');
    expect(body.addresses).toHaveLength(1);
    expect(body.addresses[0].city).toBe('Kyiv');
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0].orderNumber).toBe('ORD-001');
    expect(body.orders[0].totalAmount).toBe(500);
    expect(body.orders[0].items[0].product).toBe('Product A');
    expect(body.orders[0].items[0].quantity).toBe(2);
    expect(body.orders[0].items[0].price).toBe(200);
    expect(body.orders[0].items[0].subtotal).toBe(400);
    expect(body.wishlists).toHaveLength(1);
    expect(body.wishlists[0].name).toBe('My List');
    expect(body.wishlists[0].products[0].name).toBe('Fav Product');
    expect(body.wishlists[0].products[0].code).toBe('FP1');
    // product is null - should use fallback empty strings
    expect(body.wishlists[0].products[1].name).toBe('');
    expect(body.wishlists[0].products[1].code).toBe('');
  });

  it('returns 404 when user not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/v1/me/export');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    mockFindUnique.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/export');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });

  it('exports user with empty orders and wishlists', async () => {
    mockFindUnique.mockResolvedValue({
      id: 1,
      email: 'test@test.com',
      fullName: null,
      phone: null,
      companyName: 'Company',
      edrpou: '12345678',
      role: 'wholesale',
      wholesaleStatus: 'approved',
      createdAt: new Date('2024-01-01'),
      addresses: [],
      orders: [],
      wishlists: [],
    });
    const req = new NextRequest('http://localhost/api/v1/me/export');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
    const body = JSON.parse(await res.text());
    expect(body.personalData.companyName).toBe('Company');
    expect(body.personalData.edrpou).toBe('12345678');
    expect(body.personalData.wholesaleStatus).toBe('approved');
    expect(body.orders).toHaveLength(0);
    expect(body.wishlists).toHaveLength(0);
  });

  it('includes exportDate in output', async () => {
    mockFindUnique.mockResolvedValue({
      id: 1,
      email: 'test@test.com',
      fullName: null,
      phone: null,
      companyName: null,
      edrpou: null,
      role: 'client',
      wholesaleStatus: null,
      createdAt: new Date(),
      addresses: [],
      orders: [],
      wishlists: [],
    });
    const req = new NextRequest('http://localhost/api/v1/me/export');
    const res = await GET(req, authCtx as any);
    const body = JSON.parse(await res.text());
    expect(body.exportDate).toBeDefined();
    expect(new Date(body.exportDate).getTime()).not.toBeNaN();
  });
});
