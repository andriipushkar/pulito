import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
  },
}));
vi.mock('@/lib/redis', () => ({
  redis: { get: vi.fn(), setex: vi.fn(), del: vi.fn() },
}));
vi.mock('./email', () => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed_password') },
}));

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { sendVerificationEmail, sendPasswordResetEmail } from './email';
import {
  sendEmailVerification,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
} from './verification';

const userFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const userUpdate = prisma.user.update as ReturnType<typeof vi.fn>;
const refreshTokenUpdateMany = prisma.refreshToken.updateMany as ReturnType<typeof vi.fn>;
const redisGet = redis.get as ReturnType<typeof vi.fn>;
const redisSetex = redis.setex as ReturnType<typeof vi.fn>;
const redisDel = redis.del as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendEmailVerification', () => {
  it('throws 404 for missing user', async () => {
    userFindUnique.mockResolvedValue(null);

    await expect(sendEmailVerification(999)).rejects.toThrow();
    await expect(sendEmailVerification(999)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 for already verified user', async () => {
    userFindUnique.mockResolvedValue({ id: 1, email: 'a@b.com', isVerified: true });

    await expect(sendEmailVerification(1)).rejects.toThrow();
    await expect(sendEmailVerification(1)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('sends email and stores token in redis', async () => {
    userFindUnique.mockResolvedValue({ id: 1, email: 'a@b.com', isVerified: false });
    redisSetex.mockResolvedValue('OK');
    (sendVerificationEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await sendEmailVerification(1);

    expect(redisSetex).toHaveBeenCalledWith(
      expect.stringContaining('verify:'),
      86400,
      '1',
    );
    expect(sendVerificationEmail).toHaveBeenCalledWith('a@b.com', expect.any(String));
  });
});

describe('verifyEmail', () => {
  it('updates user isVerified and deletes token', async () => {
    redisGet.mockResolvedValue('42');
    userUpdate.mockResolvedValue({});
    redisDel.mockResolvedValue(1);

    await verifyEmail('some-token');

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { isVerified: true },
    });
    expect(redisDel).toHaveBeenCalledWith('verify:some-token');
  });

  it('throws 400 for invalid token', async () => {
    redisGet.mockResolvedValue(null);

    await expect(verifyEmail('bad-token')).rejects.toThrow();
    await expect(verifyEmail('bad-token')).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('requestPasswordReset', () => {
  it('does nothing for missing user', async () => {
    userFindUnique.mockResolvedValue(null);

    await requestPasswordReset('missing@example.com');

    expect(redisSetex).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('sends email for found user', async () => {
    userFindUnique.mockResolvedValue({ id: 5, email: 'user@example.com' });
    redisSetex.mockResolvedValue('OK');
    (sendPasswordResetEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await requestPasswordReset('user@example.com');

    expect(redisSetex).toHaveBeenCalledWith(
      expect.stringContaining('reset:'),
      3600,
      '5',
    );
    expect(sendPasswordResetEmail).toHaveBeenCalledWith('user@example.com', expect.any(String));
  });
});

describe('resetPassword', () => {
  it('updates password, deletes token, revokes refresh tokens', async () => {
    redisGet.mockResolvedValue('10');
    userUpdate.mockResolvedValue({});
    redisDel.mockResolvedValue(1);
    refreshTokenUpdateMany.mockResolvedValue({ count: 2 });

    await resetPassword('reset-token', 'newPass123');

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { passwordHash: 'hashed_password' },
    });
    expect(redisDel).toHaveBeenCalledWith('reset:reset-token');
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: 10, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('throws 400 for invalid token', async () => {
    redisGet.mockResolvedValue(null);

    await expect(resetPassword('bad', 'pass')).rejects.toThrow();
    await expect(resetPassword('bad', 'pass')).rejects.toMatchObject({ statusCode: 400 });
  });
});
