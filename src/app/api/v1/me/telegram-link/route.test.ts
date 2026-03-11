import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/telegram', () => ({
  linkTelegramAccount: vi.fn(),
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { POST } from './route';
import { linkTelegramAccount } from '@/services/telegram';

const mockLink = linkTelegramAccount as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('POST /api/v1/me/telegram-link', () => {
  beforeEach(() => vi.clearAllMocks());

  it('links telegram account', async () => {
    mockLink.mockResolvedValue(true);
    const req = new NextRequest('http://localhost/api/v1/me/telegram-link', {
      method: 'POST',
      body: JSON.stringify({ token: 'valid-token' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid token', async () => {
    mockLink.mockResolvedValue(false);
    const req = new NextRequest('http://localhost/api/v1/me/telegram-link', {
      method: 'POST',
      body: JSON.stringify({ token: 'bad-token' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 422 for missing token', async () => {
    const req = new NextRequest('http://localhost/api/v1/me/telegram-link', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(422);
  });

  it('returns 500 on error', async () => {
    mockLink.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/telegram-link', {
      method: 'POST',
      body: JSON.stringify({ token: 'tok' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
