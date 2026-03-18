import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/validators/personal-price', () => ({ updatePersonalPriceSchema: { safeParse: vi.fn() } }));
vi.mock('@/services/personal-price', () => ({
  updatePersonalPrice: vi.fn(),
  deletePersonalPrice: vi.fn(),
  PersonalPriceError: class PersonalPriceError extends Error { statusCode = 400; },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    personalPrice: { findUnique: vi.fn() },
  },
}));

import { GET, PUT, DELETE } from './route';
import { prisma } from '@/lib/prisma';
import { updatePersonalPrice, deletePersonalPrice } from '@/services/personal-price';
import { updatePersonalPriceSchema } from '@/validators/personal-price';

const mockCtx = { params: Promise.resolve({ id: '1' }) };

describe('GET /api/v1/admin/personal-prices/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns personal price on success', async () => {
    vi.mocked(prisma.personalPrice.findUnique).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost');
    const res = await GET(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.personalPrice.findUnique).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost');
    const res = await GET(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/admin/personal-prices/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates personal price on success', async () => {
    vi.mocked(updatePersonalPriceSchema.safeParse).mockReturnValue({ success: true, data: { price: 60 } } as any);
    vi.mocked(updatePersonalPrice).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ price: 60 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(updatePersonalPriceSchema.safeParse).mockReturnValue({ success: true, data: { price: 60 } } as any);
    vi.mocked(updatePersonalPrice).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ price: 60 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/personal-prices/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes personal price on success', async () => {
    vi.mocked(deletePersonalPrice).mockResolvedValue(undefined as any);
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(deletePersonalPrice).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 for non-numeric id', async () => {
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns PersonalPriceError status on PersonalPriceError', async () => {
    const { PersonalPriceError } = await import('@/services/personal-price');
    vi.mocked(deletePersonalPrice).mockRejectedValue(new (PersonalPriceError as any)('not found'));
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/admin/personal-prices/[id] - edge cases', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 for non-numeric id', async () => {
    const req = new Request('http://localhost');
    const res = await GET(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    vi.mocked(prisma.personalPrice.findUnique).mockResolvedValue(null);
    const req = new Request('http://localhost');
    const res = await GET(req as any, mockCtx as any);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/admin/personal-prices/[id] - edge cases', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 for non-numeric id', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ price: 60 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 on validation failure', async () => {
    vi.mocked(updatePersonalPriceSchema.safeParse).mockReturnValue({ success: false, error: { issues: [{ message: 'invalid' }] } } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ price: -1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns PersonalPriceError status on PersonalPriceError', async () => {
    const { PersonalPriceError } = await import('@/services/personal-price');
    vi.mocked(updatePersonalPriceSchema.safeParse).mockReturnValue({ success: true, data: { price: 60 } } as any);
    vi.mocked(updatePersonalPrice).mockRejectedValue(new (PersonalPriceError as any)('conflict'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ price: 60 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });
});
