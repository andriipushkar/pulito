import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '30d',
  },
}));

vi.mock('@/lib/api-handler', () => ({
  createApiHandler: (_rateLimit: any, handler: any) => handler,
}));

const mockLoginUser = vi.fn();
vi.mock('@/services/auth', () => ({
  loginUser: (...args: unknown[]) => mockLoginUser(...args),
}));
vi.mock('@/services/rate-limit', () => {
  class RateLimitError extends Error {
    statusCode: number;
    retryAfter?: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return {
    checkLoginRateLimit: vi.fn(),
    recordFailedLogin: vi.fn(),
    clearLoginAttempts: vi.fn(),
    RateLimitError,
    RATE_LIMITS: { auth: { windowMs: 60000, max: 10 } },
  };
});

import { POST } from './route';
import { AuthError } from '@/services/auth-errors';

function createRequest(body: unknown, headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('POST /api/v1/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should login successfully and return tokens', async () => {
    mockLoginUser.mockResolvedValue({
      user: { id: 1, email: 'user@test.com', role: 'client' },
      tokens: { accessToken: 'access-jwt', refreshToken: 'refresh-jwt' },
    });

    const res = await POST(createRequest({
      email: 'user@test.com',
      password: 'password123',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBe('access-jwt');
    expect(res.headers.get('set-cookie')).toContain('refresh_token=refresh-jwt');
  });

  it('should return 422 for invalid input', async () => {
    const res = await POST(createRequest({ email: 'bad', password: '' }));
    expect(res.status).toBe(422);
  });

  it('should return 401 for wrong credentials', async () => {
    mockLoginUser.mockRejectedValue(new AuthError('Невірний email або пароль', 401));

    const res = await POST(createRequest({
      email: 'user@test.com',
      password: 'wrong',
    }));

    expect(res.status).toBe(401);
  });

  it('should return 500 for unexpected errors', async () => {
    mockLoginUser.mockRejectedValue(new Error('unexpected'));

    const res = await POST(createRequest({
      email: 'u@t.com',
      password: 'pass1234',
    }));

    expect(res.status).toBe(500);
  });
});
