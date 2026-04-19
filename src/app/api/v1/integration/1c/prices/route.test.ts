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
vi.mock('@/middleware/api-key-auth', () => ({
  withApiKey:
    (..._scopes: string[][]) =>
    (handler: any) =>
      handler,
}));
vi.mock('@/services/integration-1c', () => ({ updatePricesFrom1C: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    integrationSync: { create: vi.fn(), update: vi.fn() },
  },
}));
vi.mock('@/validators/integration-1c', () => ({
  oneCPriceUpdateSchema: { safeParse: vi.fn() },
}));

import { POST } from './route';
import { updatePricesFrom1C } from '@/services/integration-1c';
import { prisma } from '@/lib/prisma';
import { oneCPriceUpdateSchema } from '@/validators/integration-1c';

describe('POST /api/v1/integration/1c/prices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 422 on invalid body', async () => {
    vi.mocked(oneCPriceUpdateSchema.safeParse).mockReturnValue({
      success: false,
      error: { issues: [{ message: 'Invalid prices' }] },
    } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(422);
  });

  it('updates prices successfully', async () => {
    vi.mocked(oneCPriceUpdateSchema.safeParse).mockReturnValue({
      success: true,
      data: { prices: [{ code: 'P1', price: 100 }] },
    } as any);
    vi.mocked(prisma.integrationSync.create).mockResolvedValue({ id: 1 } as any);
    vi.mocked(updatePricesFrom1C).mockResolvedValue({
      total: 1,
      processed: 1,
      created: 0,
      updated: 1,
      failed: 0,
      errors: [],
    });
    vi.mocked(prisma.integrationSync.update).mockResolvedValue({} as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prices: [{ code: 'P1', price: 100 }] }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.processed).toBe(1);
  });

  it('returns 500 on error', async () => {
    vi.mocked(oneCPriceUpdateSchema.safeParse).mockImplementation(() => {
      throw new Error('fail');
    });
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
