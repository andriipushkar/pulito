import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret', JWT_REFRESH_TTL: '7d' } }));

vi.mock('@/services/auth', () => ({
  verifyTwoFactorLogin: vi.fn(),
}));

vi.mock('@/services/token', () => ({
  parseTtlToSeconds: vi.fn().mockReturnValue(604800),
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

vi.mock('@/utils/cookies', () => ({
  serializeRefreshTokenCookie: vi.fn().mockReturnValue('refresh_token=abc; HttpOnly'),
}));

vi.mock('@/utils/request', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  getDeviceInfo: vi.fn().mockReturnValue('test-device'),
}));

vi.mock('@/lib/redis', () => ({
  redis: { incr: vi.fn().mockResolvedValue(1), expire: vi.fn().mockResolvedValue(1) },
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { POST } from './route';
import { verifyTwoFactorLogin } from '@/services/auth';
import { AuthError } from '@/services/auth-errors';

const mockVerify = verifyTwoFactorLogin as ReturnType<typeof vi.fn>;

function makeReq(body: any) {
  return new NextRequest('http://localhost/api/v1/auth/2fa/verify-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/auth/2fa/verify-login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 422 for missing fields', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(422);
  });

  it('returns tokens on success', async () => {
    mockVerify.mockResolvedValue({
      user: { id: 1, email: 'test@test.com' },
      tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
    });
    const res = await POST(makeReq({ tempToken: 'temp-token-value', code: '123456' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.accessToken).toBe('access-token');
  });

  it('returns AuthError status on auth failure', async () => {
    mockVerify.mockRejectedValue(new AuthError('Invalid code', 401));
    const res = await POST(makeReq({ tempToken: 'temp-token-value', code: '123456' }));
    expect(res.status).toBe(401);
  });

  it('returns 500 on unexpected error', async () => {
    mockVerify.mockRejectedValue(new Error('unexpected'));
    const res = await POST(makeReq({ tempToken: 'temp-token-value', code: '123456' }));
    expect(res.status).toBe(500);
  });
});
