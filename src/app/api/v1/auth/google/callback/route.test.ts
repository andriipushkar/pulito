import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '',
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
    verifyOAuthState: vi.fn().mockReturnValue({ valid: true, returnUrl: null }),
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

vi.mock('@/services/audit', () => ({ logAudit: vi.fn() }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@/utils/request', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  getDeviceInfo: vi.fn().mockReturnValue({ userAgent: 'test', ip: '127.0.0.1' }),
}));

import { GET } from './route';
import {
  exchangeCodeForTokens,
  getGoogleUserProfile,
  verifyOAuthState,
  GoogleOAuthError,
} from '@/services/google-oauth';
import { loginWithGoogle } from '@/services/auth';

const mockExchange = exchangeCodeForTokens as ReturnType<typeof vi.fn>;
const mockGetProfile = getGoogleUserProfile as ReturnType<typeof vi.fn>;
const mockVerifyState = verifyOAuthState as ReturnType<typeof vi.fn>;
const mockLoginWithGoogle = loginWithGoogle as ReturnType<typeof vi.fn>;

describe('GET /api/v1/auth/google/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyState.mockReturnValue({ valid: true, returnUrl: null });
  });

  it('redirects to callback on success', async () => {
    mockExchange.mockResolvedValue({ access_token: 'gtoken' });
    mockGetProfile.mockResolvedValue({ id: 'g1', email: 'u@g.com', name: 'User', picture: 'pic' });
    mockLoginWithGoogle.mockResolvedValue({ user: { id: 42, email: 'u@g.com' }, tokens: { accessToken: 'at', refreshToken: 'rt' } });

    const req = new NextRequest('http://localhost/api/v1/auth/google/callback?code=authcode&state=validstate', {
      headers: { cookie: 'oauth_state=validstate' },
    });
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/auth/callback');
    expect(res.headers.get('location')).not.toContain('returnUrl');
  });

  it('forwards returnUrl from verified state to /auth/callback', async () => {
    mockExchange.mockResolvedValue({ access_token: 'gtoken' });
    mockGetProfile.mockResolvedValue({ id: 'g1', email: 'u@g.com', name: 'User', picture: 'pic' });
    mockLoginWithGoogle.mockResolvedValue({ user: { id: 42, email: 'u@g.com' }, tokens: { accessToken: 'at', refreshToken: 'rt' } });
    mockVerifyState.mockReturnValue({ valid: true, returnUrl: '/admin' });

    const req = new NextRequest(
      'http://localhost/api/v1/auth/google/callback?code=authcode&state=validstate',
    );
    const res = await GET(req);
    expect(res.status).toBe(307);
    const loc = res.headers.get('location') || '';
    expect(loc).toContain('/auth/callback');
    expect(loc).toMatch(/returnUrl=%2Fadmin|returnUrl=\/admin/);
  });

  it('redirects to login on invalid state', async () => {
    mockVerifyState.mockReturnValue({ valid: false });
    const req = new NextRequest(
      'http://localhost/api/v1/auth/google/callback?code=authcode&state=bad',
    );
    const res = await GET(req);
    expect(res.headers.get('location')).toContain('error=invalid_state');
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
    const req = new NextRequest('http://localhost/api/v1/auth/google/callback?code=bad&state=validstate', {
      headers: { cookie: 'oauth_state=validstate' },
    });
    const res = await GET(req);
    expect(res.headers.get('location')).toContain('error=oauth_failed');
  });

  it('redirects on generic error', async () => {
    mockExchange.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/auth/google/callback?code=bad&state=validstate', {
      headers: { cookie: 'oauth_state=validstate' },
    });
    const res = await GET(req);
    expect(res.headers.get('location')).toContain('error=server_error');
  });
});
