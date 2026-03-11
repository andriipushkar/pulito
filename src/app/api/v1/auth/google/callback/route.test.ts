import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    APP_URL: 'https://test.com',
    JWT_REFRESH_TTL: '7d',
  },
}));

vi.mock('@/services/google-oauth', () => {
  class GoogleOAuthError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return {
    exchangeCodeForTokens: vi.fn(),
    getGoogleUserProfile: vi.fn(),
    GoogleOAuthError,
  };
});

vi.mock('@/services/auth', () => ({
  loginWithGoogle: vi.fn(),
}));

vi.mock('@/services/token', () => ({
  parseTtlToSeconds: vi.fn().mockReturnValue(604800),
}));

vi.mock('@/utils/cookies', () => ({
  serializeRefreshTokenCookie: vi.fn().mockReturnValue('refreshToken=abc; HttpOnly'),
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET } from './route';
import { exchangeCodeForTokens, getGoogleUserProfile, GoogleOAuthError } from '@/services/google-oauth';
import { loginWithGoogle } from '@/services/auth';

const mockExchange = exchangeCodeForTokens as ReturnType<typeof vi.fn>;
const mockGetProfile = getGoogleUserProfile as ReturnType<typeof vi.fn>;
const mockLoginWithGoogle = loginWithGoogle as ReturnType<typeof vi.fn>;

describe('GET /api/v1/auth/google/callback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects with access token on success', async () => {
    mockExchange.mockResolvedValue({ access_token: 'gtoken' });
    mockGetProfile.mockResolvedValue({ id: 'g1', email: 'u@g.com', name: 'User', picture: 'pic' });
    mockLoginWithGoogle.mockResolvedValue({ tokens: { accessToken: 'at', refreshToken: 'rt' } });

    const req = new NextRequest('http://localhost/api/v1/auth/google/callback?code=authcode');
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('accessToken=at');
  });

  it('redirects to login with error=oauth_denied when error param', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/google/callback?error=access_denied');
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('error=oauth_denied');
  });

  it('redirects to login with error=no_code when no code', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/google/callback');
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('error=no_code');
  });

  it('redirects on GoogleOAuthError', async () => {
    mockExchange.mockRejectedValue(new GoogleOAuthError('fail', 400));
    const req = new NextRequest('http://localhost/api/v1/auth/google/callback?code=bad');
    const res = await GET(req);
    expect(res.headers.get('location')).toContain('error=oauth_failed');
  });

  it('redirects on generic error', async () => {
    mockExchange.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/auth/google/callback?code=bad');
    const res = await GET(req);
    expect(res.headers.get('location')).toContain('error=server_error');
  });
});
