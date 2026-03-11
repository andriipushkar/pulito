import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockRedis } = vi.hoisted(() => {
  const mockFn = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  });

  return {
    mockPrisma: {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $queryRaw: vi.fn(),
      user: mockFn(),
      refreshToken: mockFn(),
    },
    mockRedis: {
      ping: vi.fn().mockResolvedValue('PONG'),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      setex: vi.fn().mockResolvedValue('OK'),
      expire: vi.fn().mockResolvedValue(1),
      ttl: vi.fn().mockResolvedValue(-1),
      keys: vi.fn().mockResolvedValue([]),
      quit: vi.fn().mockResolvedValue('OK'),
      status: 'ready',
    },
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/redis', () => ({ redis: mockRedis }));
vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '30d',
  },
}));

import {
  registerUser,
  loginUser,
  loginWithGoogle,
  refreshTokens,
  logoutUser,
  isAccessTokenBlacklisted,
  getUserById,
} from './auth';
import { signAccessToken, signRefreshToken, hashToken } from './token';

const bcrypt = await import('bcryptjs');

describe('auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerUser', () => {
    it('should register a new user and return tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 1,
        email: 'new@test.com',
        role: 'client',
        fullName: 'Test User',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });

      const result = await registerUser({
        email: 'new@test.com',
        password: 'password123',
        fullName: 'Test User',
      });

      expect(result.user.id).toBe(1);
      expect(result.user.email).toBe('new@test.com');
      expect(result.user.role).toBe('client');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(mockPrisma.user.create).toHaveBeenCalledOnce();
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledOnce();
    });

    it('should throw 409 if user already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, email: 'exists@test.com' });

      await expect(
        registerUser({ email: 'exists@test.com', password: 'pass1234', fullName: 'Existing' })
      ).rejects.toThrow('Користувач з таким email вже існує');
    });

    it('should hash the password before storing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 2,
        email: 'hash@test.com',
        role: 'client',
        fullName: 'Hash Test',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });

      await registerUser({ email: 'hash@test.com', password: 'mypassword', fullName: 'Hash Test' });

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.passwordHash).not.toBe('mypassword');
      expect(createCall.data.passwordHash).toMatch(/^\$2[aby]?\$/);
    });
  });

  describe('loginUser', () => {
    it('should login with valid credentials', async () => {
      const hash = await bcrypt.hash('correct-pass', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'user@test.com',
        passwordHash: hash,
        role: 'client',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });

      const result = await loginUser({ email: 'user@test.com', password: 'correct-pass' });

      expect(result.user.email).toBe('user@test.com');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should throw 401 for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        loginUser({ email: 'no@test.com', password: 'pass' })
      ).rejects.toThrow('Невірний email або пароль');
    });

    it('should throw 401 for wrong password', async () => {
      const hash = await bcrypt.hash('correct', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'user@test.com',
        passwordHash: hash,
        role: 'client',
      });

      await expect(
        loginUser({ email: 'user@test.com', password: 'wrong' })
      ).rejects.toThrow('Невірний email або пароль');
    });

    it('should throw 401 for user without password (OAuth-only)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'oauth@test.com',
        passwordHash: null,
        role: 'client',
      });

      await expect(
        loginUser({ email: 'oauth@test.com', password: 'any' })
      ).rejects.toThrow('Невірний email або пароль');
    });
  });

  describe('refreshTokens', () => {
    it('should rotate tokens successfully', async () => {
      const oldRefresh = signRefreshToken({ sub: 1 });
      const tokenHash = hashToken(oldRefresh);

      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 10,
        tokenHash,
        userId: 1,
        revokedAt: null,
      });
      mockPrisma.refreshToken.update.mockResolvedValue({ id: 10 });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'user@test.com',
        role: 'client',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 11 });

      const result = await refreshTokens(oldRefresh);

      expect(result.user.id).toBe(1);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10 },
          data: { revokedAt: expect.any(Date) },
        })
      );
    });

    it('should throw 401 for revoked refresh token', async () => {
      const oldRefresh = signRefreshToken({ sub: 1 });
      const tokenHash = hashToken(oldRefresh);

      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 10,
        tokenHash,
        revokedAt: new Date(),
      });

      await expect(refreshTokens(oldRefresh)).rejects.toThrow('Refresh token відкликано');
    });

    it('should throw 401 for unknown refresh token', async () => {
      const oldRefresh = signRefreshToken({ sub: 1 });
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(refreshTokens(oldRefresh)).rejects.toThrow('Refresh token відкликано');
    });

    it('should throw 401 for invalid refresh token', async () => {
      await expect(refreshTokens('invalid-token')).rejects.toThrow('Невалідний refresh token');
    });
  });

  describe('logoutUser', () => {
    it('should blacklist access token and revoke refresh token', async () => {
      const accessToken = signAccessToken({ sub: 1, email: 'u@t.com', role: 'client' });
      const refreshToken = signRefreshToken({ sub: 1 });

      mockRedis.setex.mockResolvedValue('OK');
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await logoutUser(accessToken, refreshToken);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('bl:'),
        expect.any(Number),
        '1'
      );
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledOnce();
    });

    it('should handle logout without refresh token', async () => {
      const accessToken = signAccessToken({ sub: 1, email: 'u@t.com', role: 'client' });

      mockRedis.setex.mockResolvedValue('OK');

      await logoutUser(accessToken);

      expect(mockRedis.setex).toHaveBeenCalled();
      expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('isAccessTokenBlacklisted', () => {
    it('should return true if token is blacklisted', async () => {
      mockRedis.get.mockResolvedValue('1');
      const result = await isAccessTokenBlacklisted('some-token');
      expect(result).toBe(true);
    });

    it('should return false if token is not blacklisted', async () => {
      mockRedis.get.mockResolvedValue(null);
      const result = await isAccessTokenBlacklisted('some-token');
      expect(result).toBe(false);
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'user@test.com',
        role: 'admin',
      });

      const user = await getUserById(1);
      expect(user).toEqual({ id: 1, email: 'user@test.com', role: 'admin' });
    });

    it('should return null when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const user = await getUserById(999);
      expect(user).toBeNull();
    });
  });

  describe('registerUser - referral code', () => {
    it('should register with referral code', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 3,
        email: 'ref@test.com',
        role: 'client',
        fullName: 'Ref User',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });

      const result = await registerUser({
        email: 'ref@test.com',
        password: 'password123',
        fullName: 'Ref User',
        referralCode: 'REF123',
      });

      expect(result.user.id).toBe(3);
      expect(result.tokens.accessToken).toBeDefined();
    });

    it('should register with optional fields (phone, companyName, edrpou)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 4,
        email: 'full@test.com',
        role: 'client',
        fullName: 'Full User',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });

      const result = await registerUser({
        email: 'full@test.com',
        password: 'password123',
        fullName: 'Full User',
        phone: '+380501234567',
        companyName: 'Test Co',
        edrpou: '12345678',
      });

      expect(result.user.id).toBe(4);
      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.phone).toBe('+380501234567');
    });
  });

  describe('loginUser - with IP and device', () => {
    it('should login with ipAddress and deviceInfo', async () => {
      const hash = await bcrypt.hash('pass123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'user@test.com',
        passwordHash: hash,
        role: 'client',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });

      const result = await loginUser({
        email: 'user@test.com',
        password: 'pass123',
        ipAddress: '192.168.1.1',
        deviceInfo: 'Chrome/120',
      });

      expect(result.user.email).toBe('user@test.com');
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ipAddress: '192.168.1.1',
            deviceInfo: 'Chrome/120',
          }),
        })
      );
    });
  });

  describe('refreshTokens - user not found', () => {
    it('should throw 401 when user no longer exists', async () => {
      const oldRefresh = signRefreshToken({ sub: 1 });
      const tokenHash = hashToken(oldRefresh);

      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 10,
        tokenHash,
        userId: 1,
        revokedAt: null,
      });
      mockPrisma.refreshToken.update.mockResolvedValue({ id: 10 });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(refreshTokens(oldRefresh)).rejects.toThrow('Користувача не знайдено');
    });
  });

  describe('logoutUser - expired access token', () => {
    it('should not blacklist an already expired token (remaining <= 0)', async () => {
      // Create a token that simulates already being expired by passing a bad string
      // The getTokenRemainingSeconds should return <= 0 for an invalid/expired token
      await logoutUser('expired.token.value');
      // setex should not be called if remaining <= 0
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });

  describe('loginWithGoogle', () => {
    it('should create new user if googleId and email not found', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // googleId lookup
        .mockResolvedValueOnce(null); // email lookup
      mockPrisma.user.create.mockResolvedValue({
        id: 10,
        email: 'google@test.com',
        role: 'client',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });

      const result = await loginWithGoogle('gid-123', 'google@test.com', 'Google User', 'https://avatar.url');

      expect(result.user.id).toBe(10);
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'google@test.com',
            googleId: 'gid-123',
            isVerified: true,
          }),
        })
      );
    });

    it('should link googleId to existing email user', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // googleId lookup
        .mockResolvedValueOnce({ id: 5, email: 'existing@test.com', role: 'client', avatarUrl: null }); // email lookup
      mockPrisma.user.update.mockResolvedValue({
        id: 5,
        email: 'existing@test.com',
        role: 'client',
        googleId: 'gid-456',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });

      const result = await loginWithGoogle('gid-456', 'existing@test.com', 'Existing User');

      expect(result.user.id).toBe(5);
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('should return existing user found by googleId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 7,
        email: 'guser@test.com',
        role: 'client',
        googleId: 'gid-789',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });

      const result = await loginWithGoogle('gid-789', 'guser@test.com', 'Google User');

      expect(result.user.id).toBe(7);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should process referral for new user with referral code', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // googleId
        .mockResolvedValueOnce(null); // email
      mockPrisma.user.create.mockResolvedValue({
        id: 11,
        email: 'newref@test.com',
        role: 'client',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });

      const result = await loginWithGoogle('gid-new', 'newref@test.com', 'New User', undefined, 'REF456');

      expect(result.user.id).toBe(11);
    });
  });
});
