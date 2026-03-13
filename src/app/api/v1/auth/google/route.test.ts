import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    GoogleOAuthError,
  };
});

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET } from './route';
import { getGoogleAuthUrl, GoogleOAuthError } from '@/services/google-oauth';

const mockGetGoogleAuthUrl = getGoogleAuthUrl as ReturnType<typeof vi.fn>;

describe('GET /api/v1/auth/google', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects to Google auth URL', async () => {
    mockGetGoogleAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth?test=1');
    const res = await GET();
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('accounts.google.com');
  });

  it('returns error on GoogleOAuthError', async () => {
    mockGetGoogleAuthUrl.mockImplementation(() => { throw new GoogleOAuthError('Not configured', 500); });
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it('returns 500 on generic error', async () => {
    mockGetGoogleAuthUrl.mockImplementation(() => { throw new Error('fail'); });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
