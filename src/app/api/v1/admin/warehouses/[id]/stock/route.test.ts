import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    APP_URL: 'https://test.com',
    CRON_SECRET: 'test-cron-secret',
    APP_SECRET: 'test-app-secret',
  },
}));
vi.mock('@/middleware/auth', () => ({
  withRole:
    (..._roles: string[]) =>
    (handler: any) =>
      handler,
}));
vi.mock('@/services/warehouse', () => ({
  updateStock: vi.fn(),
  WarehouseError: class WarehouseError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));
vi.mock('@/validators/warehouse', () => ({
  updateStockSchema: {
    safeParse: vi.fn((data: any) => {
      if (data.items && Array.isArray(data.items)) return { success: true, data };
      return { success: false, error: { issues: [{ message: 'Items required' }] } };
    }),
  },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    warehouseStock: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));
vi.mock('@/services/audit', () => ({ logAudit: vi.fn() }));
vi.mock('@/services/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, retryAfter: 0 }),
  RATE_LIMITS: { adminExport: { prefix: 'rl:adminexport:', max: 10, windowSec: 60 } },
}));

import { GET, PUT } from './route';
import { updateStock, WarehouseError } from '@/services/warehouse';

const ctx = (idStr: string) => ({ params: Promise.resolve({ id: idStr }), user: { id: 1 } }) as any;

function fakeReq(opts?: { method?: string; body?: unknown }) {
  return {
    headers: { get: () => null },
    nextUrl: { searchParams: new URLSearchParams() },
    json: async () => opts?.body ?? {},
  } as any;
}

describe('GET /api/v1/admin/warehouses/[id]/stock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated stock', async () => {
    const res = await GET(fakeReq(), ctx('1'));
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const res = await GET(fakeReq(), ctx('abc'));
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/v1/admin/warehouses/[id]/stock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates stock', async () => {
    vi.mocked(updateStock).mockResolvedValue({ updated: 1, before: { 1: null } });
    const res = await PUT(
      fakeReq({ method: 'PUT', body: { items: [{ productId: 1, quantity: 20 }] } }),
      ctx('1'),
    );
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const res = await PUT(fakeReq({ method: 'PUT', body: { items: [] } }), ctx('abc'));
    expect(res.status).toBe(400);
  });

  it('returns 422 for validation error', async () => {
    const res = await PUT(fakeReq({ method: 'PUT', body: {} }), ctx('1'));
    expect(res.status).toBe(422);
  });

  it('returns 429 when rate-limited', async () => {
    const { checkRateLimit } = await import('@/services/rate-limit');
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfter: 30,
    });
    const res = await PUT(
      fakeReq({ method: 'PUT', body: { items: [{ productId: 1, quantity: 20 }] } }),
      ctx('1'),
    );
    expect(res.status).toBe(429);
  });

  it('returns WarehouseError status code', async () => {
    vi.mocked(updateStock).mockRejectedValue(new WarehouseError('Not found', 404));
    const res = await PUT(
      fakeReq({ method: 'PUT', body: { items: [{ productId: 1, quantity: 20 }] } }),
      ctx('1'),
    );
    expect(res.status).toBe(404);
  });

  it('returns 500 on generic error', async () => {
    vi.mocked(updateStock).mockRejectedValue(new Error('fail'));
    const res = await PUT(
      fakeReq({ method: 'PUT', body: { items: [{ productId: 1, quantity: 20 }] } }),
      ctx('1'),
    );
    expect(res.status).toBe(500);
  });
});
