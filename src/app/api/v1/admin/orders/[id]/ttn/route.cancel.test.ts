import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => {
  const wrap =
    (..._roles: string[]) =>
    (handler: any) =>
    (req: unknown, ctx?: Record<string, unknown>) =>
      handler(req, { user: { id: 1, role: 'admin' }, ...(ctx || {}) });
  return { withRole: wrap };
});
vi.mock('@/validators/nova-poshta', () => ({ createTTNSchema: { safeParse: vi.fn() } }));
vi.mock('@/services/marketplace-tracking', () => ({ pushTrackingSafe: vi.fn() }));
vi.mock('@/services/audit', () => ({ logAudit: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json({ success: true, data }, { status }),
  errorResponse: (error: string, status = 400) =>
    Response.json({ success: false, error }, { status }),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: { order: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock('@/services/nova-poshta', () => ({
  NovaPoshtaError: class NovaPoshtaError extends Error {
    statusCode: number;
    constructor(msg: string, status = 400) {
      super(msg);
      this.statusCode = status;
    }
  },
  createInternetDocument: vi.fn(),
  deleteInternetDocument: vi.fn(),
}));

import { DELETE } from './route';
import { prisma } from '@/lib/prisma';
import { deleteInternetDocument } from '@/services/nova-poshta';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () =>
  new NextRequest('http://localhost/api/v1/admin/orders/5/ttn', { method: 'DELETE' });

beforeEach(() => vi.clearAllMocks());

describe('DELETE /api/v1/admin/orders/[id]/ttn (cancel)', () => {
  it('cancels the TTN at NP and clears the tracking fields', async () => {
    vi.mocked(prisma.order.findUnique as any).mockResolvedValue({
      id: 5,
      trackingNumber: '20450000000001',
      trackingRef: 'doc-ref',
    });
    vi.mocked(deleteInternetDocument).mockResolvedValue(true);

    const res = await (DELETE as any)(req(), ctx('5'));
    expect(res.status).toBe(200);
    expect(deleteInternetDocument).toHaveBeenCalledWith('doc-ref');
    expect(prisma.order.update as any).toHaveBeenCalledWith(
      expect.objectContaining({ data: { trackingNumber: null, trackingRef: null } }),
    );
  });

  it('refuses to cancel a manually-entered TTN (no Ref) without calling NP', async () => {
    vi.mocked(prisma.order.findUnique as any).mockResolvedValue({
      id: 5,
      trackingNumber: '20450000000001',
      trackingRef: null,
    });
    const res = await (DELETE as any)(req(), ctx('5'));
    expect(res.status).toBe(400);
    expect(deleteInternetDocument).not.toHaveBeenCalled();
  });

  it('returns 400 when the order has no TTN', async () => {
    vi.mocked(prisma.order.findUnique as any).mockResolvedValue({
      id: 5,
      trackingNumber: null,
      trackingRef: null,
    });
    const res = await (DELETE as any)(req(), ctx('5'));
    expect(res.status).toBe(400);
    expect(deleteInternetDocument).not.toHaveBeenCalled();
  });

  it('returns 404 when the order does not exist', async () => {
    vi.mocked(prisma.order.findUnique as any).mockResolvedValue(null);
    const res = await (DELETE as any)(req(), ctx('5'));
    expect(res.status).toBe(404);
  });
});
