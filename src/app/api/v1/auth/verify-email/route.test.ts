import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/verification', () => ({
  verifyEmail: vi.fn(),
  sendEmailVerification: vi.fn(),
}));

vi.mock('@/services/auth-errors', () => {
  class AuthError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return { AuthError };
});

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { POST, PUT } from './route';
import { verifyEmail, sendEmailVerification } from '@/services/verification';
import { AuthError } from '@/services/auth-errors';

const mockVerifyEmail = verifyEmail as ReturnType<typeof vi.fn>;
const mockSendEmailVerification = sendEmailVerification as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/v1/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/v1/auth/verify-email', () => {
  beforeEach(() => vi.clearAllMocks());

  it('verifies email with valid token', async () => {
    mockVerifyEmail.mockResolvedValue(undefined);
    const res = await POST(makeRequest({ token: 'valid-token' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('returns 400 for missing token', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns AuthError status on POST', async () => {
    mockVerifyEmail.mockRejectedValue(new AuthError('Token expired', 400));
    const res = await POST(makeRequest({ token: 'expired-tok' }));
    expect(res.status).toBe(400);
  });

  it('returns 500 on server error', async () => {
    mockVerifyEmail.mockRejectedValue(new Error('fail'));
    const res = await POST(makeRequest({ token: 'tok' }));
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/auth/verify-email', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resends verification email', async () => {
    mockSendEmailVerification.mockResolvedValue(undefined);
    const req = new NextRequest('http://localhost/api/v1/auth/verify-email', { method: 'PUT' });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(200);
    expect(mockSendEmailVerification).toHaveBeenCalledWith(1);
  });

  it('returns AuthError status', async () => {
    mockSendEmailVerification.mockRejectedValue(new AuthError('Already verified', 400));
    const req = new NextRequest('http://localhost/api/v1/auth/verify-email', { method: 'PUT' });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on server error', async () => {
    mockSendEmailVerification.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/auth/verify-email', { method: 'PUT' });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
