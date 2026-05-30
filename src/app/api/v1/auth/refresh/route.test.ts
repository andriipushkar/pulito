import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '30d',
  },
}));

const mockRefreshTokens = vi.fn();
vi.mock('@/services/auth', () => ({
  refreshTokens: (...args: unknown[]) => mockRefreshTokens(...args),
}));

// Mock Prisma so the cookie-selection loop (which queries refreshToken.findUnique
// to pick the freshest non-revoked candidate) runs against deterministic rows
// instead of a real DB — otherwise the test box's missing `test` credentials
// surfaced as prisma:error noise and the selection logic went uncovered.
const mockFindUnique = vi.fn();
vi.mock('@/lib/prisma', () => ({
  prisma: {
    refreshToken: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

// Stub the per-IP rate limiter so it always allows. The route calls
// checkRateLimit() first thing, and vitest runs the whole suite in a single
// fork (pool: forks, singleFork), so the in-memory limiter accumulates calls
// from every other auth test on the same localhost IP — without this stub the
// later tests here trip to 429 in a full-suite run while passing standalone.
// RATE_LIMITS and RateLimitError stay real (the route reads RATE_LIMITS.auth
// and does `instanceof RateLimitError`).
const mockCheckRateLimit = vi.fn();
vi.mock('@/services/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/rate-limit')>();
  return {
    ...actual,
    checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  };
});

import { POST } from './route';
import { AuthError } from '@/services/auth-errors';
import { hashToken } from '@/services/token';

function createRequest(cookie?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (cookie) {
    headers['cookie'] = cookie;
  }
  return new NextRequest('http://localhost/api/v1/auth/refresh', {
    method: 'POST',
    headers,
  });
}

describe('POST /api/v1/auth/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Always allow — see the rate-limit mock note above.
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    // Default: no token row exists, so the loop falls back to the last candidate.
    mockFindUnique.mockResolvedValue(null);
  });

  it('should refresh tokens successfully', async () => {
    mockFindUnique.mockResolvedValue({ revokedAt: null });
    mockRefreshTokens.mockResolvedValue({
      user: { id: 1, email: 'user@test.com', role: 'client' },
      tokens: { accessToken: 'new-access', refreshToken: 'new-refresh' },
    });

    const res = await POST(createRequest('refresh_token=old-refresh-jwt'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBe('new-access');
    expect(res.headers.get('set-cookie')).toContain('refresh_token=new-refresh');
  });

  it('should return 200 with an empty session when no refresh cookie', async () => {
    // A guest with no refresh cookie is not an error — AuthProvider calls this
    // on every page load, so returning 401 logged a noisy console error. We now
    // return 200 with a null session so the browser stays quiet.
    const res = await POST(createRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeNull();
    expect(body.data.user).toBeNull();
  });

  it('clears the cookie and returns 200 for an invalid refresh token', async () => {
    // An expired/invalid token (401 from refreshTokens) means the session ended.
    // We clear the dead cookie and return a null session so a returning visitor
    // self-heals instead of getting a 401 in the console on every load.
    mockRefreshTokens.mockRejectedValue(new AuthError('Невалідний refresh token', 401));

    const res = await POST(createRequest('refresh_token=bad-token'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeNull();
    expect(body.data.user).toBeNull();
    // The dead cookie is expired (Max-Age=0) so the browser drops it.
    expect(res.headers.get('set-cookie')).toMatch(/refresh_token=;.*Max-Age=0/i);
  });

  it('clears the cookie and returns 200 for a revoked refresh token', async () => {
    mockRefreshTokens.mockRejectedValue(new AuthError('Refresh token відкликано', 401));

    const res = await POST(createRequest('refresh_token=revoked-token'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.accessToken).toBeNull();
    expect(res.headers.get('set-cookie')).toMatch(/refresh_token=;.*Max-Age=0/i);
  });

  it('still surfaces a non-401 AuthError as an error', async () => {
    // A 403 (e.g. blocked account) is a genuine problem, not a stale session —
    // it must NOT be silently swallowed into a 200.
    mockRefreshTokens.mockRejectedValue(new AuthError('Доступ заборонено', 403));

    const res = await POST(createRequest('refresh_token=some-token'));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
  });

  it('should return 500 for unexpected errors', async () => {
    mockFindUnique.mockResolvedValue({ revokedAt: null });
    mockRefreshTokens.mockRejectedValue(new Error('DB error'));

    const res = await POST(createRequest('refresh_token=some-token'));

    expect(res.status).toBe(500);
  });

  describe('cookie selection', () => {
    it('picks the freshest non-revoked candidate when multiple cookies are sent', async () => {
      // Browsers can send several refresh_token cookies (different Path/Domain
      // from older deploys). The route must pick the live one, not just the first.
      const revoked = 'revoked-token';
      const live = 'live-token';
      mockFindUnique.mockImplementation(({ where }: { where: { tokenHash: string } }) => {
        if (where.tokenHash === hashToken(revoked))
          return Promise.resolve({ revokedAt: new Date() });
        if (where.tokenHash === hashToken(live)) return Promise.resolve({ revokedAt: null });
        return Promise.resolve(null);
      });
      mockRefreshTokens.mockResolvedValue({
        user: { id: 1, email: 'user@test.com', role: 'client' },
        tokens: { accessToken: 'new-access', refreshToken: 'new-refresh' },
      });

      const res = await POST(createRequest(`refresh_token=${revoked}; refresh_token=${live}`));

      expect(res.status).toBe(200);
      // refreshTokens must be called with the LIVE token, not the revoked one.
      expect(mockRefreshTokens).toHaveBeenCalledWith(live, expect.anything(), expect.anything());
    });

    it('falls back to the last candidate when none match a live DB row', async () => {
      // No candidate is found in the DB → fall back to the last cookie so
      // refreshTokens() still gets a token to validate. The invalid result is
      // then turned into a cleared cookie + 200 null session (see above).
      mockFindUnique.mockResolvedValue(null);
      mockRefreshTokens.mockRejectedValue(new AuthError('Невалідний refresh token', 401));

      const res = await POST(createRequest('refresh_token=first; refresh_token=last'));

      expect(res.status).toBe(200);
      expect(mockRefreshTokens).toHaveBeenCalledWith('last', expect.anything(), expect.anything());
    });

    it('tolerates a DB error while probing a candidate and tries the next', async () => {
      // A findUnique failure for one candidate must not abort selection — the
      // loop swallows it and continues to the next cookie.
      const broken = 'broken-token';
      const live = 'live-token';
      mockFindUnique.mockImplementation(({ where }: { where: { tokenHash: string } }) => {
        if (where.tokenHash === hashToken(broken)) return Promise.reject(new Error('DB down'));
        if (where.tokenHash === hashToken(live)) return Promise.resolve({ revokedAt: null });
        return Promise.resolve(null);
      });
      mockRefreshTokens.mockResolvedValue({
        user: { id: 1, email: 'user@test.com', role: 'client' },
        tokens: { accessToken: 'new-access', refreshToken: 'new-refresh' },
      });

      const res = await POST(createRequest(`refresh_token=${broken}; refresh_token=${live}`));

      expect(res.status).toBe(200);
      expect(mockRefreshTokens).toHaveBeenCalledWith(live, expect.anything(), expect.anything());
    });
  });
});
