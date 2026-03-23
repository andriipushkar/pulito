import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/api-key-auth', () => ({ withApiKey: (..._scopes: string[][]) => (handler: any) => handler }));
vi.mock('@/services/integration-1c', () => ({ updateStockFrom1C: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    integrationSync: { create: vi.fn(), update: vi.fn() },
  },
}));
vi.mock('@/validators/integration-1c', () => ({
  oneCStockUpdateSchema: { safeParse: vi.fn() },
}));

import { POST } from './route';
import { updateStockFrom1C } from '@/services/integration-1c';
import { prisma } from '@/lib/prisma';
import { oneCStockUpdateSchema } from '@/validators/integration-1c';

describe('POST /api/v1/integration/1c/stock', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 422 on invalid body', async () => {
    vi.mocked(oneCStockUpdateSchema.safeParse).mockReturnValue({
      success: false,
      error: { issues: [{ message: 'Invalid stock data' }] },
    } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(422);
  });

  it('updates stock successfully', async () => {
    vi.mocked(oneCStockUpdateSchema.safeParse).mockReturnValue({
      success: true,
      data: { stock: [{ code: 'P1', quantity: 50 }] },
    } as any);
    vi.mocked(prisma.integrationSync.create).mockResolvedValue({ id: 1 } as any);
    vi.mocked(updateStockFrom1C).mockResolvedValue({ processed: 1, failed: 0, errors: [] });
    vi.mocked(prisma.integrationSync.update).mockResolvedValue({} as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: [{ code: 'P1', quantity: 50 }] }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.processed).toBe(1);
  });

  it('returns 500 on error', async () => {
    vi.mocked(oneCStockUpdateSchema.safeParse).mockImplementation(() => { throw new Error('fail'); });
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
