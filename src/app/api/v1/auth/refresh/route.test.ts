import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '30d',
  },
}));

const mockRefreshTokens = vi.fn();
vi.mock('@/services/auth', () => ({
  refreshTokens: (...args: unknown[]) => mockRefreshTokens(...args),
}));

import { POST } from './route';
import { AuthError } from '@/services/auth-errors';

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
  });

  it('should refresh tokens successfully', async () => {
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

  it('should return 401 when no refresh cookie', async () => {
    const res = await POST(createRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toContain('Refresh token не надано');
  });

  it('should return 401 for invalid refresh token', async () => {
    mockRefreshTokens.mockRejectedValue(new AuthError('Невалідний refresh token', 401));

    const res = await POST(createRequest('refresh_token=bad-token'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toContain('Невалідний');
  });

  it('should return 401 for revoked refresh token', async () => {
    mockRefreshTokens.mockRejectedValue(new AuthError('Refresh token відкликано', 401));

    const res = await POST(createRequest('refresh_token=revoked-token'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toContain('відкликано');
  });

  it('should return 500 for unexpected errors', async () => {
    mockRefreshTokens.mockRejectedValue(new Error('DB error'));

    const res = await POST(createRequest('refresh_token=some-token'));

    expect(res.status).toBe(500);
  });
});
