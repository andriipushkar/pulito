import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

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

import {
  parseTtlToSeconds,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getTokenRemainingSeconds,
} from './token';

describe('token utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseTtlToSeconds', () => {
    it('should parse seconds', () => {
      expect(parseTtlToSeconds('30s')).toBe(30);
    });

    it('should parse minutes', () => {
      expect(parseTtlToSeconds('15m')).toBe(900);
    });

    it('should parse hours', () => {
      expect(parseTtlToSeconds('2h')).toBe(7200);
    });

    it('should parse days', () => {
      expect(parseTtlToSeconds('30d')).toBe(2592000);
    });

    it('should throw on invalid format', () => {
      expect(() => parseTtlToSeconds('invalid')).toThrow('Invalid TTL format');
    });

    it('should throw on empty string', () => {
      expect(() => parseTtlToSeconds('')).toThrow('Invalid TTL format');
    });
  });

  describe('hashToken', () => {
    it('should return a SHA-256 hex hash', () => {
      const hash = hashToken('test-token');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should return consistent hashes', () => {
      expect(hashToken('same-token')).toBe(hashToken('same-token'));
    });

    it('should return different hashes for different tokens', () => {
      expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
    });
  });

  describe('signAccessToken / verifyAccessToken', () => {
    it('should sign and verify an access token', () => {
      const token = signAccessToken({ sub: 1, email: 'test@test.com', role: 'client' });
      const decoded = verifyAccessToken(token);

      expect(decoded.sub).toBe(1);
      expect(decoded.email).toBe('test@test.com');
      expect(decoded.role).toBe('client');
      expect(decoded.type).toBe('access');
    });

    it('should reject an expired access token', () => {
      const token = jwt.sign(
        { sub: 1, email: 'test@test.com', role: 'client', type: 'access' },
        'test-jwt-secret-minimum-16-chars',
        { expiresIn: -1 }
      );

      expect(() => verifyAccessToken(token)).toThrow();
    });

    it('should reject a refresh token used as access', () => {
      const token = signRefreshToken({ sub: 1 });
      expect(() => verifyAccessToken(token)).toThrow('Invalid token type');
    });

    it('should reject a token with invalid secret', () => {
      const token = jwt.sign(
        { sub: 1, email: 'test@test.com', role: 'client', type: 'access' },
        'wrong-secret-key-for-testing',
        { expiresIn: 900 }
      );

      expect(() => verifyAccessToken(token)).toThrow();
    });
  });

  describe('signRefreshToken / verifyRefreshToken', () => {
    it('should sign and verify a refresh token', () => {
      const token = signRefreshToken({ sub: 42 });
      const decoded = verifyRefreshToken(token);

      expect(decoded.sub).toBe(42);
      expect(decoded.type).toBe('refresh');
    });

    it('should reject an access token used as refresh', () => {
      const token = signAccessToken({ sub: 1, email: 'test@test.com', role: 'client' });
      expect(() => verifyRefreshToken(token)).toThrow('Invalid token type');
    });
  });

  describe('getTokenRemainingSeconds', () => {
    it('should return remaining seconds for a valid token', () => {
      const token = signAccessToken({ sub: 1, email: 'test@test.com', role: 'client' });
      const remaining = getTokenRemainingSeconds(token);

      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(900);
    });

    it('should return 0 for an expired token', () => {
      const token = jwt.sign({ sub: 1, type: 'access' }, 'test-jwt-secret-minimum-16-chars', {
        expiresIn: -10,
      });

      expect(getTokenRemainingSeconds(token)).toBe(0);
    });

    it('should return 0 for a token without exp', () => {
      const token = jwt.sign({ sub: 1 }, 'test-jwt-secret-minimum-16-chars');
      expect(getTokenRemainingSeconds(token)).toBe(0);
    });

    it('should return 0 for an invalid token string', () => {
      expect(getTokenRemainingSeconds('not-a-jwt')).toBe(0);
    });
  });
});
