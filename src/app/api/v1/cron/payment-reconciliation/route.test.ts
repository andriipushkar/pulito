import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({
  env: { APP_SECRET: 'super-secret-cron-token' },
}));
const reconcileMock = vi.hoisted(() => vi.fn());
vi.mock('@/services/jobs/payment-reconciliation', () => ({
  reconcileStuckPayments: reconcileMock,
}));

import { POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('cron auth — /api/v1/cron/payment-reconciliation', () => {
  it('rejects request with missing Authorization header', async () => {
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
    expect(reconcileMock).not.toHaveBeenCalled();
  });

  it('rejects request with wrong token', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong-token' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
    expect(reconcileMock).not.toHaveBeenCalled();
  });

  it('accepts request with correct Bearer token', async () => {
    reconcileMock.mockResolvedValue({ checked: 3, resolved: 1 });
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { authorization: 'Bearer super-secret-cron-token' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(reconcileMock).toHaveBeenCalled();
  });

  it('returns 500 if job throws', async () => {
    reconcileMock.mockRejectedValue(new Error('DB down'));
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { authorization: 'Bearer super-secret-cron-token' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
