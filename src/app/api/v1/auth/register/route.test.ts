import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '30d',
  },
}));

vi.mock('@/services/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, retryAfter: 0 }),
  RATE_LIMITS: { auth: { prefix: 'rl:auth:', max: 10, windowSec: 60 } },
  RateLimitError: class RateLimitError extends Error {
    statusCode: number;
    retryAfter?: number;
    constructor(message: string, statusCode = 429, retryAfter?: number) {
      super(message);
      this.statusCode = statusCode;
      this.retryAfter = retryAfter;
    }
  },
}));

const mockRegisterUser = vi.fn();
vi.mock('@/services/auth', () => ({
  registerUser: (...args: unknown[]) => mockRegisterUser(...args),
}));

import { POST } from './route';
import { AuthError } from '@/services/auth-errors';

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/v1/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register successfully and return 201', async () => {
    mockRegisterUser.mockResolvedValue({
      user: { id: 1, email: 'new@test.com', role: 'client' },
      tokens: { accessToken: 'access-jwt', refreshToken: 'refresh-jwt' },
    });

    const res = await POST(createRequest({
      email: 'new@test.com',
      password: 'Password1!',
      fullName: 'Тест Юзер',
    }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe('new@test.com');
    expect(body.data.accessToken).toBe('access-jwt');
    expect(res.headers.get('set-cookie')).toContain('refresh_token=refresh-jwt');
  });

  it('should return 422 for invalid body', async () => {
    const res = await POST(createRequest({
      email: 'not-an-email',
      password: 'short',
      fullName: 'A',
    }));
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });

  it('should return 422 for missing fields', async () => {
    const res = await POST(createRequest({}));
    expect(res.status).toBe(422);
  });

  it('should return 409 for duplicate email', async () => {
    mockRegisterUser.mockRejectedValue(new AuthError('Користувач з таким email вже існує', 409));

    const res = await POST(createRequest({
      email: 'dup@test.com',
      password: 'Password1!',
      fullName: 'Duplicate User',
    }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('вже існує');
  });

  it('should return 500 for unexpected errors', async () => {
    mockRegisterUser.mockRejectedValue(new Error('DB down'));

    const res = await POST(createRequest({
      email: 'err@test.com',
      password: 'Password1!',
      fullName: 'Error User',
    }));

    expect(res.status).toBe(500);
  });
});
