import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/verification', () => ({
  resetPassword: vi.fn(),
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

import { POST } from './route';
import { resetPassword } from '@/services/verification';
import { AuthError } from '@/services/auth-errors';

const mockResetPassword = resetPassword as ReturnType<typeof vi.fn>;

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/v1/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/v1/auth/reset-password', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns success for valid data', async () => {
    mockResetPassword.mockResolvedValue(undefined);
    const res = await POST(makeRequest({ token: 'valid-token', password: 'NewPassword1!' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('returns 422 for missing token', async () => {
    const res = await POST(makeRequest({ password: 'NewPassword1!' }));
    expect(res.status).toBe(422);
  });

  it('returns AuthError status on AuthError', async () => {
    mockResetPassword.mockRejectedValue(new AuthError('Token expired', 400));
    const res = await POST(makeRequest({ token: 'expired', password: 'NewPassword1!' }));
    expect(res.status).toBe(400);
  });

  it('returns 500 on server error', async () => {
    mockResetPassword.mockRejectedValue(new Error('fail'));
    const res = await POST(makeRequest({ token: 'valid', password: 'NewPassword1!' }));
    expect(res.status).toBe(500);
  });
});
