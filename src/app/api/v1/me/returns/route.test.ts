import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: (..._roles: string[]) => (handler: Function) => handler,
}));

vi.mock('@/services/return-request', () => {
  class ReturnError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return {
    createReturnRequest: vi.fn(),
    getUserReturns: vi.fn(),
    ReturnError,
  };
});

vi.mock('@/validators/return-request', () => ({
  createReturnSchema: {
    safeParse: vi.fn(),
  },
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { GET, POST } from './route';
import { createReturnRequest, getUserReturns, ReturnError } from '@/services/return-request';
import { createReturnSchema } from '@/validators/return-request';

const mockGetReturns = getUserReturns as ReturnType<typeof vi.fn>;
const mockCreateReturn = createReturnRequest as ReturnType<typeof vi.fn>;
const mockSafeParse = createReturnSchema.safeParse as ReturnType<typeof vi.fn>;

const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('GET /api/v1/me/returns', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated returns', async () => {
    mockGetReturns.mockResolvedValue({ returns: [{ id: 1 }], total: 1 });
    const req = new NextRequest('http://localhost/api/v1/me/returns?page=1&limit=10');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.total).toBe(1);
  });

  it('returns 500 on error', async () => {
    mockGetReturns.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/returns');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/me/returns', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 422 on validation error', async () => {
    mockSafeParse.mockReturnValue({ success: false, error: { issues: [{ message: 'invalid' }] } });
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(422);
  });

  it('creates return request on success', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { orderId: 1, reason: 'defect' } });
    mockCreateReturn.mockResolvedValue({ id: 1, status: 'pending' });
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 1, reason: 'defect' }),
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(201);
  });

  it('returns ReturnError status', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { orderId: 1, reason: 'defect' } });
    mockCreateReturn.mockRejectedValue(new ReturnError('Not eligible', 400));
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 1, reason: 'defect' }),
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on unexpected error', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { orderId: 1, reason: 'defect' } });
    mockCreateReturn.mockRejectedValue(new Error('db fail'));
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 1, reason: 'defect' }),
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
