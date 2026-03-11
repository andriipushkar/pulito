import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/user', () => ({
  approveWholesale: vi.fn(),
  rejectWholesale: vi.fn(),
  UserError: class UserError extends Error { statusCode = 400; },
}));

import { PUT } from './route';
import { approveWholesale, rejectWholesale } from '@/services/user';

const mockCtx = { user: { id: 1 }, params: Promise.resolve({ id: '2' }) };

describe('PUT /api/v1/admin/users/[id]/wholesale', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('approves wholesale on success', async () => {
    vi.mocked(approveWholesale).mockResolvedValue({ id: 2 } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ action: 'approve' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('rejects wholesale on success', async () => {
    vi.mocked(rejectWholesale).mockResolvedValue({ id: 2 } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ action: 'reject' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ action: 'approve' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, { user: { id: 1 }, params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for unknown action', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ action: 'unknown' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('handles UserError', async () => {
    const { UserError } = await import('@/services/user');
    vi.mocked(approveWholesale).mockRejectedValue(new UserError('Not found'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ action: 'approve' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on unexpected error', async () => {
    vi.mocked(approveWholesale).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ action: 'approve' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});
