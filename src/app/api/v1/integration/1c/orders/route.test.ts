import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/api-key-auth', () => ({ withApiKey: (..._scopes: string[][]) => (handler: any) => handler }));
vi.mock('@/services/integration-1c', () => ({ exportOrdersTo1C: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    integrationSync: { create: vi.fn(), update: vi.fn() },
    order: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock('@/validators/integration-1c', () => ({
  oneCOrderStatusBatchSchema: {
    safeParse: vi.fn(),
  },
}));

import { GET, POST } from './route';
import { exportOrdersTo1C } from '@/services/integration-1c';
import { prisma } from '@/lib/prisma';
import { oneCOrderStatusBatchSchema } from '@/validators/integration-1c';

describe('GET /api/v1/integration/1c/orders', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('exports orders successfully', async () => {
    vi.mocked(exportOrdersTo1C).mockResolvedValue([{ id: 1 }] as any);
    const req = new NextRequest('http://localhost/api/v1/integration/1c/orders');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.total).toBe(1);
  });

  it('passes filter params', async () => {
    vi.mocked(exportOrdersTo1C).mockResolvedValue([]);
    const req = new NextRequest('http://localhost/api/v1/integration/1c/orders?status=completed&from=2024-01-01');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(exportOrdersTo1C).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
  });

  it('returns 500 on error', async () => {
    vi.mocked(exportOrdersTo1C).mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/integration/1c/orders');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/integration/1c/orders', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 422 on invalid body', async () => {
    vi.mocked(oneCOrderStatusBatchSchema.safeParse).mockReturnValue({
      success: false,
      error: { issues: [{ message: 'Invalid' }] },
    } as any);
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('processes order status updates', async () => {
    vi.mocked(oneCOrderStatusBatchSchema.safeParse).mockReturnValue({
      success: true,
      data: { orders: [{ orderNumber: 'ORD-001', status: 'shipped' }] },
    } as any);
    vi.mocked(prisma.integrationSync.create).mockResolvedValue({ id: 1 } as any);
    vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(prisma.order.update).mockResolvedValue({} as any);
    vi.mocked(prisma.integrationSync.update).mockResolvedValue({} as any);
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders: [{ orderNumber: 'ORD-001', status: 'shipped' }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.processed).toBe(1);
  });

  it('handles not found orders', async () => {
    vi.mocked(oneCOrderStatusBatchSchema.safeParse).mockReturnValue({
      success: true,
      data: { orders: [{ orderNumber: 'ORD-999', status: 'shipped' }] },
    } as any);
    vi.mocked(prisma.integrationSync.create).mockResolvedValue({ id: 1 } as any);
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.integrationSync.update).mockResolvedValue({} as any);
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders: [{ orderNumber: 'ORD-999', status: 'shipped' }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.failed).toBe(1);
  });

  it('returns 500 on error', async () => {
    vi.mocked(oneCOrderStatusBatchSchema.safeParse).mockImplementation(() => { throw new Error('fail'); });
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
