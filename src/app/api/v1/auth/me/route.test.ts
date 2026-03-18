import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '30d',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
  },
}));

const mockGetUserById = vi.fn();
const mockIsBlacklisted = vi.fn().mockResolvedValue(false);
vi.mock('@/services/auth', () => ({
  getUserById: (...args: unknown[]) => mockGetUserById(...args),
  isAccessTokenBlacklisted: (...args: unknown[]) => mockIsBlacklisted(...args),
}));

import { GET } from './route';
import { signAccessToken } from '@/services/token';

function createRequest(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }
  return new NextRequest('http://localhost/api/v1/auth/me', { headers });
}

describe('GET /api/v1/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBlacklisted.mockResolvedValue(false);
  });

  it('should return current user data', async () => {
    const token = signAccessToken({ sub: 1, email: 'user@test.com', role: 'client' });
    mockGetUserById.mockResolvedValue({ id: 1, email: 'user@test.com', role: 'client' });

    const res = await GET(createRequest(token));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe('user@test.com');
  });

  it('should return 401 without token', async () => {
    const res = await GET(createRequest());
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid token', async () => {
    const res = await GET(createRequest('invalid'));
    expect(res.status).toBe(401);
  });

  it('should return 404 if user deleted', async () => {
    const token = signAccessToken({ sub: 999, email: 'gone@test.com', role: 'client' });
    mockGetUserById.mockResolvedValue(null);

    const res = await GET(createRequest(token));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain('не знайдено');
  });

  it('should return 401 for blacklisted token', async () => {
    const token = signAccessToken({ sub: 1, email: 'user@test.com', role: 'client' });
    mockIsBlacklisted.mockResolvedValue(true);

    const res = await GET(createRequest(token));
    expect(res.status).toBe(401);
  });
});
