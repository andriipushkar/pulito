import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { sendVerificationEmail, sendPasswordResetEmail } from './email';
import { AuthError } from './auth-errors';

const VERIFY_PREFIX = 'verify:';
const RESET_PREFIX = 'reset:';
const VERIFY_TTL = 86400; // 24 hours
const RESET_TTL = 3600; // 1 hour
const SALT_ROUNDS = 10;

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ─── Email Verification ─────────────────────

export async function sendEmailVerification(userId: number): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, isVerified: true },
  });

  if (!user) throw new AuthError('Користувача не знайдено', 404);
  if (user.isVerified) throw new AuthError('Email вже підтверджено', 400);

  const token = generateToken();
  await redis.setex(`${VERIFY_PREFIX}${token}`, VERIFY_TTL, String(userId));

  await sendVerificationEmail(user.email, token);
}

export async function verifyEmail(token: string): Promise<void> {
  const userId = await redis.get(`${VERIFY_PREFIX}${token}`);
  if (!userId) {
    throw new AuthError('Невалідне або прострочене посилання підтвердження', 400);
  }

  await prisma.user.update({
    where: { id: Number(userId) },
    data: { isVerified: true },
  });

  await redis.del(`${VERIFY_PREFIX}${token}`);
}

// ─── Password Reset ─────────────────────

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  // Always return success to prevent email enumeration
  if (!user) return;

  const token = generateToken();
  await redis.setex(`${RESET_PREFIX}${token}`, RESET_TTL, String(user.id));

  await sendPasswordResetEmail(user.email, token);
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const userId = await redis.get(`${RESET_PREFIX}${token}`);
  if (!userId) {
    throw new AuthError('Невалідне або прострочене посилання відновлення', 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: Number(userId) },
    data: { passwordHash },
  });

  // Invalidate token
  await redis.del(`${RESET_PREFIX}${token}`);

  // Revoke all refresh tokens for this user (force re-login)
  await prisma.refreshToken.updateMany({
    where: { userId: Number(userId), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
