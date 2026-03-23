import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: (..._roles: string[]) => (handler: Function) => handler,
}));

vi.mock('@/services/reorder', () => {
  class ReorderError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return {
    reorderFromOrder: vi.fn(),
    ReorderError,
  };
});

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { POST } from './route';
import { reorderFromOrder, ReorderError } from '@/services/reorder';

const mockReorder = reorderFromOrder as ReturnType<typeof vi.fn>;

const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ orderId: '5' }) };
const invalidCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ orderId: 'abc' }) };

describe('POST /api/v1/reorder/[orderId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 for invalid orderId', async () => {
    const req = new NextRequest('http://localhost', { method: 'POST' });
    const res = await POST(req, invalidCtx as any);
    expect(res.status).toBe(400);
  });

  it('reorders successfully', async () => {
    mockReorder.mockResolvedValue({ cartItems: 3, skipped: [] });
    const req = new NextRequest('http://localhost', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns ReorderError status', async () => {
    mockReorder.mockRejectedValue(new ReorderError('Order not found', 404));
    const req = new NextRequest('http://localhost', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 500 on unexpected error', async () => {
    mockReorder.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
