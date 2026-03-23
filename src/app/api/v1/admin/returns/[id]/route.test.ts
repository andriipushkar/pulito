import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/services/return-request', () => ({
  processReturn: vi.fn(),
  markReturnReceived: vi.fn(),
  markReturnRefunded: vi.fn(),
  ReturnError: class ReturnError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));
vi.mock('@/validators/return-request', () => ({
  processReturnSchema: {
    safeParse: vi.fn((data: any) => {
      if (data.status === 'approved' || data.status === 'rejected') {
        return { success: true, data };
      }
      return { success: false, error: { issues: [{ message: 'Invalid' }] } };
    }),
  },
}));

import { PATCH } from './route';
import { processReturn, markReturnReceived, markReturnRefunded, ReturnError } from '@/services/return-request';

describe('PATCH /api/v1/admin/returns/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('marks return as received', async () => {
    vi.mocked(markReturnReceived).mockResolvedValue({ id: 1, status: 'received' } as any);

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'received' }),
    });
    const res = await PATCH(req as any, { user: { id: 1 }, params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe('received');
  });

  it('marks return as refunded', async () => {
    vi.mocked(markReturnRefunded).mockResolvedValue({ id: 1, status: 'refunded' } as any);

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refunded' }),
    });
    const res = await PATCH(req as any, { user: { id: 1 }, params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe('refunded');
  });

  it('processes return with approve/reject', async () => {
    vi.mocked(processReturn).mockResolvedValue({ id: 1, status: 'approved' } as any);

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', adminComment: 'ok' }),
    });
    const res = await PATCH(req as any, { user: { id: 1 }, params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'received' }),
    });
    const res = await PATCH(req as any, { user: { id: 1 }, params: Promise.resolve({ id: '0' }) });

    expect(res.status).toBe(400);
  });

  it('returns ReturnError status code', async () => {
    vi.mocked(markReturnReceived).mockRejectedValue(new ReturnError('Not found', 404));

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'received' }),
    });
    const res = await PATCH(req as any, { user: { id: 1 }, params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(404);
  });

  it('returns 500 on generic error', async () => {
    vi.mocked(markReturnReceived).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'received' }),
    });
    const res = await PATCH(req as any, { user: { id: 1 }, params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});
