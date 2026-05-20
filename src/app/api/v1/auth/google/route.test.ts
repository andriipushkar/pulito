import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/google-oauth', () => {
  class GoogleOAuthError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return {
    getGoogleAuthUrl: vi.fn(),
    generateOAuthState: vi.fn().mockReturnValue('mock-state'),
    isSafeReturnUrl: (p: string) =>
      typeof p === 'string' && p.startsWith('/') && !p.startsWith('//'),
    GoogleOAuthError,
  };
});

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET } from './route';
import { getGoogleAuthUrl, generateOAuthState, GoogleOAuthError } from '@/services/google-oauth';

const mockGetGoogleAuthUrl = getGoogleAuthUrl as ReturnType<typeof vi.fn>;
const mockGenerateOAuthState = generateOAuthState as ReturnType<typeof vi.fn>;

describe('GET /api/v1/auth/google', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects to Google auth URL', async () => {
    mockGetGoogleAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth?test=1');
    const req = new NextRequest('http://localhost/api/v1/auth/google');
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('accounts.google.com');
  });

  it('passes a safe returnUrl into generateOAuthState', async () => {
    mockGetGoogleAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth?test=1');
    const req = new NextRequest('http://localhost/api/v1/auth/google?returnUrl=/admin');
    await GET(req);
    expect(mockGenerateOAuthState).toHaveBeenCalledWith('/admin');
  });

  it('ignores unsafe returnUrl (absolute URL)', async () => {
    mockGetGoogleAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth?test=1');
    const req = new NextRequest(
      'http://localhost/api/v1/auth/google?returnUrl=https://evil.com',
    );
    await GET(req);
    expect(mockGenerateOAuthState).toHaveBeenCalledWith(undefined);
  });

  it('ignores protocol-relative returnUrl', async () => {
    mockGetGoogleAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth?test=1');
    const req = new NextRequest('http://localhost/api/v1/auth/google?returnUrl=//evil.com');
    await GET(req);
    expect(mockGenerateOAuthState).toHaveBeenCalledWith(undefined);
  });

  it('returns error on GoogleOAuthError', async () => {
    mockGetGoogleAuthUrl.mockImplementation(() => {
      throw new GoogleOAuthError('Not configured', 500);
    });
    const req = new NextRequest('http://localhost/api/v1/auth/google');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it('returns 500 on generic error', async () => {
    mockGetGoogleAuthUrl.mockImplementation(() => {
      throw new Error('fail');
    });
    const req = new NextRequest('http://localhost/api/v1/auth/google');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
