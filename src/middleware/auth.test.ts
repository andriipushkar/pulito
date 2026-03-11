import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '30d',
  },
}));

const mockIsBlacklisted = vi.fn().mockResolvedValue(false);
vi.mock('@/services/auth', () => ({
  isAccessTokenBlacklisted: (...args: unknown[]) => mockIsBlacklisted(...args),
}));

import { withAuth, withOptionalAuth, withRole } from './auth';
import { signAccessToken } from '@/services/token';

function createRequest(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }
  return new NextRequest('http://localhost/api/test', { headers });
}

describe('auth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBlacklisted.mockResolvedValue(false);
  });

  describe('withAuth', () => {
    it('should call handler with user on valid token', async () => {
      const token = signAccessToken({ sub: 1, email: 'test@test.com', role: 'client' });
      const handler = vi.fn().mockResolvedValue(new Response('ok'));

      const wrapped = withAuth(handler);
      await wrapped(createRequest(token));

      expect(handler).toHaveBeenCalledWith(
        expect.any(NextRequest),
        expect.objectContaining({
          user: { id: 1, email: 'test@test.com', role: 'client' },
        })
      );
    });

    it('should return 401 when no token provided', async () => {
      const handler = vi.fn();
      const wrapped = withAuth(handler);
      const res = await wrapped(createRequest());
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toBe('Токен не надано');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid token', async () => {
      const handler = vi.fn();
      const wrapped = withAuth(handler);
      const res = await wrapped(createRequest('invalid-token'));
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toContain('Невалідний');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should return 401 for blacklisted token', async () => {
      mockIsBlacklisted.mockResolvedValue(true);
      const token = signAccessToken({ sub: 1, email: 'test@test.com', role: 'client' });
      const handler = vi.fn();

      const wrapped = withAuth(handler);
      const res = await wrapped(createRequest(token));
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toBe('Токен відкликано');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should return 401 for malformed Authorization header', async () => {
      const handler = vi.fn();
      const wrapped = withAuth(handler);
      const req = new NextRequest('http://localhost/api/test', {
        headers: { authorization: 'Basic abc123' },
      });
      const res = await wrapped(req);

      expect(res.status).toBe(401);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('withRole', () => {
    it('should allow user with matching role', async () => {
      const token = signAccessToken({ sub: 1, email: 'admin@test.com', role: 'admin' });
      const handler = vi.fn().mockResolvedValue(new Response('ok'));

      const wrapped = withRole('admin')(handler);
      await wrapped(createRequest(token));

      expect(handler).toHaveBeenCalled();
    });

    it('should allow user with one of multiple roles', async () => {
      const token = signAccessToken({ sub: 1, email: 'mgr@test.com', role: 'manager' });
      const handler = vi.fn().mockResolvedValue(new Response('ok'));

      const wrapped = withRole('admin', 'manager')(handler);
      await wrapped(createRequest(token));

      expect(handler).toHaveBeenCalled();
    });

    it('should return 403 for user without required role', async () => {
      const token = signAccessToken({ sub: 1, email: 'user@test.com', role: 'client' });
      const handler = vi.fn();

      const wrapped = withRole('admin')(handler);
      const res = await wrapped(createRequest(token));
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error).toBe('Недостатньо прав');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should return 401 if no token (before role check)', async () => {
      const handler = vi.fn();
      const wrapped = withRole('admin')(handler);
      const res = await wrapped(createRequest());

      expect(res.status).toBe(401);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('withOptionalAuth', () => {
    it('should call handler with null user when no token', async () => {
      const handler = vi.fn().mockResolvedValue(new Response('ok'));
      const wrapped = withOptionalAuth(handler);
      await wrapped(createRequest());

      expect(handler).toHaveBeenCalledWith(
        expect.any(NextRequest),
        expect.objectContaining({ user: null })
      );
    });

    it('should call handler with user when valid token', async () => {
      const token = signAccessToken({ sub: 1, email: 'test@test.com', role: 'client' });
      const handler = vi.fn().mockResolvedValue(new Response('ok'));
      const wrapped = withOptionalAuth(handler);
      await wrapped(createRequest(token));

      expect(handler).toHaveBeenCalledWith(
        expect.any(NextRequest),
        expect.objectContaining({
          user: { id: 1, email: 'test@test.com', role: 'client' },
        })
      );
    });

    it('should call handler with null user when token is invalid', async () => {
      const handler = vi.fn().mockResolvedValue(new Response('ok'));
      const wrapped = withOptionalAuth(handler);
      await wrapped(createRequest('invalid-token'));

      expect(handler).toHaveBeenCalledWith(
        expect.any(NextRequest),
        expect.objectContaining({ user: null })
      );
    });

    it('should call handler with null user when token is blacklisted', async () => {
      mockIsBlacklisted.mockResolvedValue(true);
      const token = signAccessToken({ sub: 1, email: 'test@test.com', role: 'client' });
      const handler = vi.fn().mockResolvedValue(new Response('ok'));
      const wrapped = withOptionalAuth(handler);
      await wrapped(createRequest(token));

      expect(handler).toHaveBeenCalledWith(
        expect.any(NextRequest),
        expect.objectContaining({ user: null })
      );
    });

    it('should pass params through to handler', async () => {
      const handler = vi.fn().mockResolvedValue(new Response('ok'));
      const wrapped = withOptionalAuth(handler);
      const paramsPromise = Promise.resolve({ id: '123' });
      await wrapped(createRequest(), { params: paramsPromise });

      expect(handler).toHaveBeenCalledWith(
        expect.any(NextRequest),
        expect.objectContaining({ user: null, params: paramsPromise })
      );
    });
  });
});
