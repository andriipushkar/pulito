import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findUnique: vi.fn(), update: vi.fn() },
    product: { findUnique: vi.fn() },
  },
}));
vi.mock('@/services/telegram', () => ({ sendProductPhotoToUser: vi.fn() }));
vi.mock('@/services/viber', () => ({ sendProductPhotoToUser: vi.fn() }));

import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { sendProductPhotoToUser as sendTg } from '@/services/telegram';
import { sendProductPhotoToUser as sendViber } from '@/services/viber';

const mockCtx = { params: Promise.resolve({ id: '1' }) };

describe('POST /api/v1/admin/orders/[id]/send-product-photo', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('sends photo on success', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: 1, orderNumber: 'O1', userId: 1 } as any);
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: 1, name: 'Test', code: 'T1', imagePath: '/img.jpg', images: [] } as any);
    vi.mocked(sendTg).mockResolvedValue(true);
    vi.mocked(sendViber).mockResolvedValue(false);
    vi.mocked(prisma.order.update).mockResolvedValue({} as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ productId: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.order.findUnique).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ productId: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 for invalid order ID', async () => {
    const invalidCtx = { params: Promise.resolve({ id: 'abc' }) };
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ productId: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, invalidCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 422 on validation error', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ productId: -1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(422);
  });

  it('returns 404 when order not found', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ productId: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 when order has no userId', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: 1, orderNumber: 'O1', userId: null } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ productId: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 404 when product not found', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: 1, orderNumber: 'O1', userId: 1 } as any);
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ productId: 999 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 when product has no image', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: 1, orderNumber: 'O1', userId: 1 } as any);
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: 1, name: 'Test', code: 'T1', imagePath: null, images: [] } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ productId: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when no messengers linked', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: 1, orderNumber: 'O1', userId: 1 } as any);
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: 1, name: 'Test', code: 'T1', imagePath: '/img.jpg', images: [] } as any);
    vi.mocked(sendTg).mockResolvedValue(false);
    vi.mocked(sendViber).mockResolvedValue(false);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ productId: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('sends photo with custom message', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: 1, orderNumber: 'O1', userId: 1 } as any);
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: 1, name: 'Test', code: 'T1', imagePath: null, images: [{ pathFull: '/main.jpg' }] } as any);
    vi.mocked(sendTg).mockResolvedValue(true);
    vi.mocked(sendViber).mockResolvedValue(true);
    vi.mocked(prisma.order.update).mockResolvedValue({} as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ productId: 1, message: 'Check this!' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.telegramSent).toBe(true);
    expect(json.data.viberSent).toBe(true);
    expect(json.data.channels).toContain('Telegram');
    expect(json.data.channels).toContain('Viber');
  });
});
