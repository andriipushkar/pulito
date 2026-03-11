import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/services/quick-order', () => ({
  parseQuickOrderInput: vi.fn(),
  resolveQuickOrder: vi.fn(),
  QuickOrderError: class QuickOrderError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

import { POST } from './route';
import { parseQuickOrderInput, resolveQuickOrder } from '@/services/quick-order';

const mockedParse = vi.mocked(parseQuickOrderInput);
const mockedResolve = vi.mocked(resolveQuickOrder);

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/v1/quick-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/quick-order', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves quick order on success', async () => {
    mockedParse.mockReturnValue([{ code: 'A1', quantity: 2 }] as never);
    mockedResolve.mockResolvedValue([{ id: 1 }] as never);
    const res = await POST(makeReq({ input: 'A1 2' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 400 when input missing', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 when no lines parsed', async () => {
    mockedParse.mockReturnValue([] as never);
    const res = await POST(makeReq({ input: '???' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when input is not a string', async () => {
    const res = await POST(makeReq({ input: 123 }));
    expect(res.status).toBe(400);
  });

  it('handles QuickOrderError with custom status', async () => {
    const { QuickOrderError } = await import('@/services/quick-order');
    mockedParse.mockReturnValue([{ code: 'A1', quantity: 2 }] as never);
    mockedResolve.mockRejectedValue(new QuickOrderError('Product not found', 404));
    const res = await POST(makeReq({ input: 'A1 2' }));
    expect(res.status).toBe(404);
  });

  it('returns 500 on generic error', async () => {
    mockedParse.mockReturnValue([{ code: 'A1', quantity: 2 }] as never);
    mockedResolve.mockRejectedValue(new Error('unexpected'));
    const res = await POST(makeReq({ input: 'A1 2' }));
    expect(res.status).toBe(500);
  });
});
