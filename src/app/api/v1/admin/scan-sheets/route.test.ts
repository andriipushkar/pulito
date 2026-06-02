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
vi.mock('@/lib/prisma', () => ({
  prisma: { order: { findMany: vi.fn() } },
}));
vi.mock('@/services/audit', () => ({ logAudit: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json({ success: true, data }, { status }),
  errorResponse: (error: string, status = 400) =>
    Response.json({ success: false, error }, { status }),
}));
vi.mock('@/services/nova-poshta', () => ({
  NovaPoshtaError: class NovaPoshtaError extends Error {
    statusCode: number;
    constructor(msg: string, status = 400) {
      super(msg);
      this.statusCode = status;
    }
  },
  getScanSheetList: vi.fn(),
  insertDocumentsToScanSheet: vi.fn(),
  deleteScanSheet: vi.fn(),
}));

import { GET, POST, DELETE } from './route';
import { prisma } from '@/lib/prisma';
import {
  getScanSheetList,
  insertDocumentsToScanSheet,
  deleteScanSheet,
} from '@/services/nova-poshta';

function jsonReq(body: unknown) {
  return new NextRequest('http://localhost/api/v1/admin/scan-sheets', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/admin/scan-sheets', () => {
  it('returns the registry list', async () => {
    vi.mocked(getScanSheetList).mockResolvedValue([{ Ref: 'ss1', Number: '50001' }]);
    const res = await (GET as any)();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });
});

describe('POST /api/v1/admin/scan-sheets', () => {
  it('creates a registry from orders that have a trackingRef and reports skipped', async () => {
    vi.mocked(prisma.order.findMany as any).mockResolvedValue([
      { id: 1, trackingRef: 'ref-1', trackingNumber: '201' },
      { id: 2, trackingRef: null, trackingNumber: '202' }, // manual TTN → skipped
      { id: 3, trackingRef: 'ref-3', trackingNumber: '203' },
    ]);
    vi.mocked(insertDocumentsToScanSheet).mockResolvedValue({ ref: 'ss-ref', number: '50002' });

    const res = await (POST as any)(jsonReq({ orderIds: [1, 2, 3] }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toMatchObject({ number: '50002', added: 2, skipped: 1 });
    expect(insertDocumentsToScanSheet).toHaveBeenCalledWith(
      expect.objectContaining({ documentRefs: ['ref-1', 'ref-3'] }),
    );
  });

  it('returns 400 when no selected order has a trackingRef', async () => {
    vi.mocked(prisma.order.findMany as any).mockResolvedValue([
      { id: 1, trackingRef: null, trackingNumber: '201' },
    ]);
    const res = await (POST as any)(jsonReq({ orderIds: [1] }));
    expect(res.status).toBe(400);
    expect(insertDocumentsToScanSheet).not.toHaveBeenCalled();
  });

  it('returns 422 on invalid body (empty orderIds)', async () => {
    const res = await (POST as any)(jsonReq({ orderIds: [] }));
    expect(res.status).toBe(422);
  });
});

describe('DELETE /api/v1/admin/scan-sheets', () => {
  it('disbands the given registries', async () => {
    vi.mocked(deleteScanSheet).mockResolvedValue([] as any);
    const req = new NextRequest('http://localhost/api/v1/admin/scan-sheets', {
      method: 'DELETE',
      body: JSON.stringify({ refs: ['ss1', 'ss2'] }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await (DELETE as any)(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deleted).toBe(2);
    expect(deleteScanSheet).toHaveBeenCalledWith(['ss1', 'ss2']);
  });
});
