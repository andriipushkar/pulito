import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { sendVerificationEmail, sendPasswordResetEmail } from './email';
import { AuthError } from './auth-errors';

const VERIFY_PREFIX = 'verify:';
const RESET_PREFIX = 'reset:';
const RESET_ACTIVE_PREFIX = 'reset:active:';
const RESET_EMAIL_LOCK_PREFIX = 'reset:lock:email:';
const VERIFY_TTL = 86400; // 24 hours
const RESET_TTL = 3600; // 1 hour
const RESET_EMAIL_LOCK_TTL = 900; // 15 minutes
const RESET_EMAIL_LOCK_MAX = 3;
const SALT_ROUNDS = 10;

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
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

  // Per-email rate limit — stops an attacker rotating IPs to spam reset emails
  // (mail-bomb the inbox + flood Redis with live tokens). IP-level limiter is
  // enforced separately at the route layer.
  const lockKey = `${RESET_EMAIL_LOCK_PREFIX}${user.id}`;
  const count = await redis.incr(lockKey);
  if (count === 1) {
    await redis.expire(lockKey, RESET_EMAIL_LOCK_TTL);
  }
  if (count > RESET_EMAIL_LOCK_MAX) {
    // Silently drop — we already returned 200 to the caller for enumeration
    // protection; the user (or attacker) gets no signal that the limit hit.
    return;
  }

  // Invalidate any prior active reset token for this user so a leaked old
  // token can't outlive the new one. We track the active token-hash in a
  // per-user key.
  const activeKey = `${RESET_ACTIVE_PREFIX}${user.id}`;
  const priorHash = await redis.get(activeKey);
  if (priorHash) {
    await redis.del(`${RESET_PREFIX}${priorHash}`);
  }

  const token = generateToken();
  const tokenHash = hashResetToken(token);
  // Store under the hash, never the raw token — if Redis is compromised the
  // attacker can't directly use the stored keys to reset accounts.
  await redis.setex(`${RESET_PREFIX}${tokenHash}`, RESET_TTL, String(user.id));
  await redis.setex(activeKey, RESET_TTL, tokenHash);

  await sendPasswordResetEmail(user.email, token);
}

export async function resetPassword(token: string, newPassword: string): Promise<number> {
  const tokenHash = hashResetToken(token);
  const userId = await redis.get(`${RESET_PREFIX}${tokenHash}`);
  if (!userId) {
    throw new AuthError('Невалідне або прострочене посилання відновлення', 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const numericUserId = Number(userId);

  await prisma.user.update({
    where: { id: numericUserId },
    data: { passwordHash },
  });

  // Invalidate token + active-token marker
  await redis.del(`${RESET_PREFIX}${tokenHash}`);
  await redis.del(`${RESET_ACTIVE_PREFIX}${numericUserId}`);

  // Revoke all refresh tokens for this user (force re-login)
  await prisma.refreshToken.updateMany({
    where: { userId: numericUserId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return numericUserId;
}
