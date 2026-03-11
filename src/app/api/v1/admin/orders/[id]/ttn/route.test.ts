import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/validators/nova-poshta', () => ({ createTTNSchema: { safeParse: vi.fn() } }));
vi.mock('@/services/nova-poshta', () => ({
  createInternetDocument: vi.fn(),
  NovaPoshtaError: class NovaPoshtaError extends Error { statusCode = 400; },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { createInternetDocument } from '@/services/nova-poshta';
import { createTTNSchema } from '@/validators/nova-poshta';

const mockCtx = { params: Promise.resolve({ id: '1' }) };

describe('POST /api/v1/admin/orders/[id]/ttn', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates TTN on success', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: 1, status: 'processing', trackingNumber: null } as any);
    vi.mocked(createTTNSchema.safeParse).mockReturnValue({ success: true, data: {} } as any);
    vi.mocked(createInternetDocument).mockResolvedValue({ intDocNumber: '123', ref: 'abc', costOnSite: '50', estimatedDeliveryDate: '2025-01-01' });
    vi.mocked(prisma.order.update).mockResolvedValue({} as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(201);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 404 when order not found', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 when order already has tracking number', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: 1, status: 'processing', trackingNumber: 'EXISTING-123' } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('EXISTING-123');
  });

  it('returns 422 on validation error', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: 1, status: 'processing', trackingNumber: null } as any);
    vi.mocked(createTTNSchema.safeParse).mockReturnValue({ success: false, error: { issues: [{ message: 'bad' }] } } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(422);
  });

  it('handles NovaPoshtaError', async () => {
    const { NovaPoshtaError } = await import('@/services/nova-poshta');
    vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: 1, status: 'processing', trackingNumber: null } as any);
    vi.mocked(createTTNSchema.safeParse).mockReturnValue({ success: true, data: {} } as any);
    vi.mocked(createInternetDocument).mockRejectedValue(new NovaPoshtaError('API error'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on unexpected error', async () => {
    vi.mocked(prisma.order.findUnique).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});
