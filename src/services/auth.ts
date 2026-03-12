import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { AuthError } from './auth-errors';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  parseTtlToSeconds,
  getTokenRemainingSeconds,
} from './token';
import { env } from '@/config/env';
import type { TokenPair, AuthUser } from '@/types/auth';

const SALT_ROUNDS = 10;
const BLACKLIST_PREFIX = 'bl:';

/**
 * @description Реєструє нового користувача за email/паролем, генерує реферальний код та надсилає лист верифікації.
 * @param data - Дані реєстрації (email, пароль, ПІБ, телефон, реферальний код)
 * @returns Об'єкт з даними користувача та парою токенів
 */
export async function registerUser(data: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  referralCode?: string;
  companyName?: string;
  edrpou?: string;
}): Promise<{ user: AuthUser; tokens: TokenPair }> {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new AuthError('Користувач з таким email вже існує', 409);
  }

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

  // Generate unique referral code for the new user
  const { generateReferralCode } = await import('./referral');
  const userReferralCode = generateReferralCode();

  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      phone: data.phone,
      referralCode: userReferralCode,
      companyName: data.companyName || undefined,
      edrpou: data.edrpou || undefined,
    },
  });

  const tokens = await createTokenPair(user.id, user.email, user.role);

  // Process referral if code was provided
  if (data.referralCode) {
    import('./referral')
      .then((mod) => mod.processReferral(user.id, data.referralCode!))
      .catch(() => {});
  }

  // Send verification email asynchronously (don't block registration)
  import('./verification')
    .then((mod) => mod.sendEmailVerification(user.id))
    .catch(() => {});

  return {
    user: { id: user.id, email: user.email, role: user.role, wholesaleGroup: user.wholesaleGroup },
    tokens,
  };
}

/**
 * @description Автентифікує користувача за email та паролем, повертає токени доступу.
 * @param data - Дані для входу (email, пароль, IP-адреса, інформація про пристрій)
 * @returns Об'єкт з даними користувача та парою токенів
 */
export async function loginUser(data: {
  email: string;
  password: string;
  ipAddress?: string;
  deviceInfo?: string;
}): Promise<{ user: AuthUser; tokens: TokenPair }> {
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !user.passwordHash) {
    throw new AuthError('Невірний email або пароль', 401);
  }

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) {
    throw new AuthError('Невірний email або пароль', 401);
  }

  if (user.isBlocked) {
    throw new AuthError('Ваш акаунт заблоковано. Зверніться до підтримки.', 403);
  }

  const tokens = await createTokenPair(user.id, user.email, user.role, data.ipAddress, data.deviceInfo);

  return {
    user: { id: user.id, email: user.email, role: user.role, wholesaleGroup: user.wholesaleGroup },
    tokens,
  };
}

/**
 * @description Оновлює access token за допомогою refresh token, відкликає старий refresh token.
 * @param refreshToken - Поточний refresh token
 * @param ipAddress - IP-адреса клієнта
 * @param deviceInfo - Інформація про пристрій
 * @returns Об'єкт з даними користувача та новою парою токенів
 */
export async function refreshTokens(
  refreshToken: string,
  ipAddress?: string,
  deviceInfo?: string
): Promise<{ user: AuthUser; tokens: TokenPair }> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AuthError('Невалідний refresh token', 401);
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored) {
    throw new AuthError('Refresh token відкликано', 401);
  }

  // SECURITY: Refresh token reuse detection.
  // If a revoked token is presented, it means the token was stolen and used
  // after rotation. Revoke ALL tokens for this user (nuke the family).
  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new AuthError('Виявлено повторне використання токена. Всі сесії завершено.', 401);
  }

  // Revoke old token (normal rotation)
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    throw new AuthError('Користувача не знайдено', 401);
  }

  const tokens = await createTokenPair(user.id, user.email, user.role, ipAddress, deviceInfo);

  return {
    user: { id: user.id, email: user.email, role: user.role, wholesaleGroup: user.wholesaleGroup },
    tokens,
  };
}

/**
 * @description Виконує вихід користувача: додає access token у чорний список Redis та відкликає refresh token.
 * @param accessToken - Access token для блокування
 * @param refreshToken - Refresh token для відкликання (опціонально)
 * @returns void
 */
export async function logoutUser(accessToken: string, refreshToken?: string): Promise<void> {
  // Blacklist access token in Redis
  const remaining = getTokenRemainingSeconds(accessToken);
  if (remaining > 0) {
    const hash = hashToken(accessToken);
    await redis.setex(`${BLACKLIST_PREFIX}${hash}`, remaining, '1');
  }

  // Revoke refresh token in DB
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

/**
 * @description Перевіряє, чи знаходиться access token у чорному списку Redis.
 * @param token - Access token для перевірки
 * @returns true, якщо токен заблоковано
 */
export async function isAccessTokenBlacklisted(token: string): Promise<boolean> {
  const hash = hashToken(token);
  const result = await redis.get(`${BLACKLIST_PREFIX}${hash}`);
  return result !== null;
}

/**
 * @description Отримує користувача за його ID.
 * @param id - Ідентифікатор користувача
 * @returns Об'єкт AuthUser або null, якщо не знайдено
 */
export async function getUserById(id: number): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, wholesaleGroup: true },
  });

  if (!user) return null;
  return { id: user.id, email: user.email, role: user.role, wholesaleGroup: user.wholesaleGroup };
}

/**
 * @description OAuth-авторизація через Google. Створює нового користувача або прив'язує Google до існуючого акаунту.
 * @param googleId - Ідентифікатор Google-акаунту
 * @param email - Email користувача
 * @param name - Ім'я користувача
 * @param avatarUrl - URL аватару (опціонально)
 * @param referralCode - Реферальний код (опціонально)
 * @returns Об'єкт з даними користувача та парою токенів
 */
export async function loginWithGoogle(
  googleId: string,
  email: string,
  name: string,
  avatarUrl?: string,
  referralCode?: string
): Promise<{ user: AuthUser; tokens: TokenPair }> {
  let user = await prisma.user.findUnique({ where: { googleId } });
  let isNewUser = false;

  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId, avatarUrl: avatarUrl || user.avatarUrl },
      });
    } else {
      // Generate unique referral code for the new user
      const { generateReferralCode } = await import('./referral');
      const userReferralCode = generateReferralCode();

      user = await prisma.user.create({
        data: {
          email,
          fullName: name,
          googleId,
          avatarUrl,
          isVerified: true,
          referralCode: userReferralCode,
        },
      });
      isNewUser = true;
    }
  }

  // Process referral if code was provided (only for new users)
  if (isNewUser && referralCode) {
    import('./referral')
      .then((mod) => mod.processReferral(user!.id, referralCode))
      .catch(() => {});
  }

  const tokens = await createTokenPair(user.id, user.email, user.role);

  return {
    user: { id: user.id, email: user.email, role: user.role, wholesaleGroup: user.wholesaleGroup },
    tokens,
  };
}

async function createTokenPair(
  userId: number,
  email: string,
  role: string,
  ipAddress?: string,
  deviceInfo?: string
): Promise<TokenPair> {
  const accessToken = signAccessToken({ sub: userId, email, role });
  const refreshToken = signRefreshToken({ sub: userId });

  const tokenHash = hashToken(refreshToken);
  const refreshTtl = parseTtlToSeconds(env.JWT_REFRESH_TTL);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      ipAddress: ipAddress || null,
      deviceInfo: deviceInfo || null,
      expiresAt: new Date(Date.now() + refreshTtl * 1000),
    },
  });

  return { accessToken, refreshToken };
}
