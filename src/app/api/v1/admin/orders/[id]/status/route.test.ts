import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/validators/order', () => ({ updateOrderStatusSchema: { safeParse: vi.fn() } }));
vi.mock('@/services/order', () => ({
  updateOrderStatus: vi.fn(),
  OrderError: class OrderError extends Error { statusCode = 400; },
}));

import { PUT } from './route';
import { updateOrderStatus } from '@/services/order';
import { updateOrderStatusSchema } from '@/validators/order';

const mockCtx = { user: { id: 1 }, params: Promise.resolve({ id: '1' }) };

describe('PUT /api/v1/admin/orders/[id]/status', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates status on success', async () => {
    vi.mocked(updateOrderStatusSchema.safeParse).mockReturnValue({ success: true, data: { status: 'processing' } } as any);
    vi.mocked(updateOrderStatus).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ status: 'processing' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ status: 'processing' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, { user: { id: 1 }, params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 on validation error', async () => {
    vi.mocked(updateOrderStatusSchema.safeParse).mockReturnValue({ success: false, error: { issues: [{ message: 'bad status' }] } } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ status: 'invalid' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns OrderError status code', async () => {
    const { OrderError } = await import('@/services/order');
    vi.mocked(updateOrderStatusSchema.safeParse).mockReturnValue({ success: true, data: { status: 'processing' } } as any);
    vi.mocked(updateOrderStatus).mockRejectedValue(new (OrderError as any)('invalid transition'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ status: 'processing' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(updateOrderStatusSchema.safeParse).mockReturnValue({ success: true, data: { status: 'processing' } } as any);
    vi.mocked(updateOrderStatus).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ status: 'processing' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});
