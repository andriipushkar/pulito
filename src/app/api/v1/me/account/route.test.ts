import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/account', () => {
  class AccountError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return { deleteAccount: vi.fn(), AccountError };
});

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { DELETE } from './route';
import { deleteAccount, AccountError } from '@/services/account';

const mockDeleteAccount = deleteAccount as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('DELETE /api/v1/me/account', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes account successfully', async () => {
    mockDeleteAccount.mockResolvedValue(undefined);
    const req = new NextRequest('http://localhost/api/v1/me/account', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns AccountError status', async () => {
    mockDeleteAccount.mockRejectedValue(new AccountError('Has orders', 400));
    const req = new NextRequest('http://localhost/api/v1/me/account', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on server error', async () => {
    mockDeleteAccount.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/account', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
