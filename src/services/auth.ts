import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { Prisma } from '@/../generated/prisma';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { AuthError } from './auth-errors';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  sign2faToken,
  verify2faToken,
  hashToken,
  parseTtlToSeconds,
  getTokenRemainingSeconds,
} from './token';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
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

  let user;
  try {
    user = await prisma.user.create({
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
  } catch (err) {
    // Race: two parallel registrations for the same email both passed the
    // existence check, both tried to create. Translate the unique-constraint
    // violation into the same 409 the existence check would have produced.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AuthError('Користувач з таким email вже існує', 409);
    }
    throw err;
  }

  const tokens = await createTokenPair(user.id, user.email, user.role);

  // Process referral if code was provided. Anti-fraud checks (same phone /
  // name) live inside processReferral — silently skipped here.
  if (data.referralCode) {
    import('./referral')
      .then((mod) => mod.processReferral(user.id, data.referralCode!))
      .catch((err) =>
        logger.warn('Referral processing failed', { userId: user.id, error: String(err) }),
      );
  }

  // Welcome bonus: every new user gets points configurable via SiteSettings.
  // Set "0" to disable. Non-blocking — registration must succeed even if
  // the loyalty system is misconfigured.
  import('./settings')
    .then(async (settingsMod) => {
      const settings = await settingsMod.getSettings();
      const welcome = Math.max(0, Math.floor(Number(settings.loyalty_welcome_bonus) || 0));
      if (welcome === 0) return;
      const loyaltyMod = await import('./loyalty');
      await loyaltyMod.adjustPoints({
        userId: user.id,
        type: 'manual_add',
        points: welcome,
        description: 'Вітальний бонус за реєстрацію',
      });
    })
    .catch((err) => logger.warn('Welcome bonus failed', { userId: user.id, error: String(err) }));

  // Send verification email asynchronously (don't block registration)
  import('./verification')
    .then((mod) => mod.sendEmailVerification(user.id))
    .catch((err) =>
      logger.warn('Email verification dispatch failed', { userId: user.id, error: String(err) }),
    );

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      wholesaleGroup: user.wholesaleGroup,
      fullName: user.fullName,
      phone: user.phone ?? undefined,
      twoFactorEnabled: user.twoFactorEnabled,
    },
    tokens,
  };
}

/**
 * @description Автентифікує користувача за email та паролем, повертає токени доступу.
 * @param data - Дані для входу (email, пароль, IP-адреса, інформація про пристрій)
 * @returns Об'єкт з даними користувача та парою токенів
 */
// Pre-computed bcrypt hash of a random string — used for the user-not-found
// dummy compare so login response time is identical whether the email exists
// or not. Generated once at module load (bcrypt with 10 rounds = ~80ms cost).
const DUMMY_BCRYPT_HASH = bcrypt.hashSync('$dummy$' + randomBytes(16).toString('hex'), 10);

type LoginResult =
  | { requiresTwoFactor: false; user: AuthUser; tokens: TokenPair }
  | { requiresTwoFactor: true; tempToken: string };

export async function loginUser(data: {
  email: string;
  password: string;
  ipAddress?: string;
  deviceInfo?: string;
}): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email: data.email } });

  if (!user || !user.passwordHash) {
    // Run bcrypt against a dummy hash to equalise response time with the
    // real-user path. Without this, attackers can enumerate registered emails
    // by measuring response latency.
    await bcrypt.compare(data.password, DUMMY_BCRYPT_HASH);
    throw new AuthError('Невірний email або пароль', 401);
  }

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) {
    throw new AuthError('Невірний email або пароль', 401);
  }

  if (user.isBlocked) {
    throw new AuthError('Ваш акаунт заблоковано. Зверніться до підтримки.', 403);
  }

  // If 2FA is enabled, return a short-lived temp token instead of full credentials
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    const ipHash = createHash('sha256')
      .update(data.ipAddress || 'unknown')
      .digest('hex')
      .slice(0, 16);
    const tempToken = sign2faToken({ sub: user.id, iph: ipHash });
    return { requiresTwoFactor: true, tempToken };
  }

  const tokens = await createTokenPair(
    user.id,
    user.email,
    user.role,
    data.ipAddress,
    data.deviceInfo,
  );

  // Log successful login
  logLogin(user.id, data.ipAddress, data.deviceInfo, true).catch(() => {});

  return {
    requiresTwoFactor: false,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      wholesaleGroup: user.wholesaleGroup,
      fullName: user.fullName,
      phone: user.phone ?? undefined,
      twoFactorEnabled: user.twoFactorEnabled,
    },
    tokens,
  };
}

/**
 * @description Завершує вхід з двофакторною автентифікацією. Перевіряє тимчасовий токен та TOTP-код.
 * @param tempToken - Тимчасовий JWT-токен, отриманий після успішного введення паролю
 * @param code - 6-значний TOTP-код з додатку автентифікації
 * @param ipAddress - IP-адреса клієнта
 * @param deviceInfo - Інформація про пристрій
 * @returns Об'єкт з даними користувача та парою токенів
 */
export async function verifyTwoFactorLogin(
  tempToken: string,
  code: string,
  ipAddress?: string,
  deviceInfo?: string,
): Promise<{ user: AuthUser; tokens: TokenPair }> {
  let payload;
  try {
    payload = verify2faToken(tempToken);
  } catch {
    throw new AuthError('Невалідний або прострочений токен 2FA', 401);
  }

  // Verify IP binding
  if (payload.iph) {
    const currentIpHash = createHash('sha256')
      .update(ipAddress || 'unknown')
      .digest('hex')
      .slice(0, 16);
    if (payload.iph !== currentIpHash) {
      throw new AuthError('IP-адреса змінилася. Увійдіть знову.', 401);
    }
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
    throw new AuthError('Користувача не знайдено або 2FA не налаштовано', 401);
  }
  if (user.isBlocked) {
    throw new AuthError('Обліковий запис заблоковано', 403);
  }

  const { verifyTOTP, hashBackupCode, decryptStoredSecret } = await import('./totp');
  let totpValid = verifyTOTP(decryptStoredSecret(user.twoFactorSecret), code);

  // If TOTP failed, check backup codes
  if (!totpValid && user.twoFactorBackupCodes && user.twoFactorBackupCodes.length > 0) {
    const hashedInput = hashBackupCode(code);
    const codeIndex = user.twoFactorBackupCodes.indexOf(hashedInput);
    if (codeIndex !== -1) {
      totpValid = true;
      // Remove used backup code
      const updatedCodes = [...user.twoFactorBackupCodes];
      updatedCodes.splice(codeIndex, 1);
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorBackupCodes: updatedCodes },
      });
    }
  }

  if (!totpValid) {
    throw new AuthError('Невірний код двофакторної автентифікації', 401);
  }

  const tokens = await createTokenPair(user.id, user.email, user.role, ipAddress, deviceInfo);

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      wholesaleGroup: user.wholesaleGroup,
      fullName: user.fullName,
      phone: user.phone ?? undefined,
      twoFactorEnabled: user.twoFactorEnabled,
    },
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
  deviceInfo?: string,
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
    // Audit this as a critical security event — we may want to alert on it.
    const { logAudit } = await import('@/services/audit');
    await logAudit({
      userId: stored.userId,
      actionType: 'logout',
      entityType: 'user',
      entityId: stored.userId,
      details: { reason: 'refresh_token_reuse_detected', allSessionsRevoked: true },
      ipAddress: ipAddress ?? null,
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
  // A user blocked AFTER login would otherwise keep minting fresh access tokens
  // via refresh until the refresh token expires (days) — the block is a no-op
  // for active sessions without this check.
  if (user.isBlocked) {
    throw new AuthError('Обліковий запис заблоковано', 403);
  }

  const tokens = await createTokenPair(user.id, user.email, user.role, ipAddress, deviceInfo);

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      wholesaleGroup: user.wholesaleGroup,
      fullName: user.fullName,
      phone: user.phone ?? undefined,
      twoFactorEnabled: user.twoFactorEnabled,
    },
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
  try {
    const hash = hashToken(token);
    const result = await redis.get(`${BLACKLIST_PREFIX}${hash}`);
    return result !== null;
  } catch {
    // If Redis is down, allow the request rather than blocking all users.
    // The token is still validated by JWT signature — blacklist is an extra layer.
    return false;
  }
}

/**
 * @description Отримує користувача за його ID.
 * @param id - Ідентифікатор користувача
 * @returns Об'єкт AuthUser або null, якщо не знайдено
 */
export async function getUserById(id: number): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      fullName: true,
      phone: true,
      wholesaleGroup: true,
      twoFactorEnabled: true,
    },
  });

  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    phone: user.phone ?? undefined,
    wholesaleGroup: user.wholesaleGroup,
    twoFactorEnabled: user.twoFactorEnabled,
  };
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
  referralCode?: string,
  ipAddress?: string,
  deviceInfo?: string,
  // Whether Google verified the email. Kept LAST with a default so existing
  // callers stay source-compatible; the real OAuth callback ALWAYS passes the
  // actual flag explicitly. Gates email-based account linking below.
  emailVerified: boolean = true,
): Promise<LoginResult> {
  let user = await prisma.user.findUnique({ where: { googleId } });
  let isNewUser = false;

  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      // Account takeover guard: only auto-link Google to an existing local
      // account when Google has VERIFIED the email. Otherwise an attacker with
      // a Google account bearing an unverified copy of the victim's email could
      // attach their googleId and log in as the victim.
      if (!emailVerified) {
        throw new AuthError(
          'Google не підтвердив цю електронну адресу. Увійдіть паролем і прив’яжіть Google у налаштуваннях.',
          403,
        );
      }
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId, avatarUrl: avatarUrl || user.avatarUrl },
      });
    } else {
      // Generate unique referral code for the new user
      const { generateReferralCode } = await import('./referral');
      const userReferralCode = generateReferralCode();

      try {
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
      } catch (err) {
        // Race: two parallel Google logins for the same email both saw no
        // row, both tried to create. Whoever lost the unique-constraint race
        // re-fetches and continues with the existing user.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const existing =
            (await prisma.user.findUnique({ where: { googleId } })) ??
            (await prisma.user.findUnique({ where: { email } }));
          if (!existing) throw err;
          user = existing;
        } else {
          throw err;
        }
      }
    }
  }

  // Process referral if code was provided (only for new users)
  if (isNewUser && referralCode) {
    import('./referral').then((mod) => mod.processReferral(user!.id, referralCode)).catch(() => {});
  }

  // If 2FA is enabled, return a temp token instead of issuing full credentials.
  // Mirrors loginUser() so Google OAuth can't bypass 2FA.
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    const ipHash = createHash('sha256')
      .update(ipAddress || 'unknown')
      .digest('hex')
      .slice(0, 16);
    const tempToken = sign2faToken({ sub: user.id, iph: ipHash });
    return { requiresTwoFactor: true, tempToken };
  }

  const tokens = await createTokenPair(user.id, user.email, user.role, ipAddress, deviceInfo);

  // Best-effort audit log — Google logins used to silently skip this entirely.
  logLogin(user.id, ipAddress, deviceInfo, true).catch(() => {});

  return {
    requiresTwoFactor: false,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      wholesaleGroup: user.wholesaleGroup,
      fullName: user.fullName,
      phone: user.phone ?? undefined,
      twoFactorEnabled: user.twoFactorEnabled,
    },
    tokens,
  };
}

async function createTokenPair(
  userId: number,
  email: string,
  role: string,
  ipAddress?: string,
  deviceInfo?: string,
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

/**
 * Log a login attempt to login_history table.
 */
async function logLogin(userId: number, ipAddress?: string, userAgent?: string, success = true) {
  // Parse basic device info from user agent
  let device: string | undefined;
  let browser: string | undefined;
  let os: string | undefined;

  if (userAgent) {
    if (/Mobile|Android|iPhone/i.test(userAgent)) device = 'mobile';
    else if (/Tablet|iPad/i.test(userAgent)) device = 'tablet';
    else device = 'desktop';

    if (/Chrome/i.test(userAgent)) browser = 'Chrome';
    else if (/Firefox/i.test(userAgent)) browser = 'Firefox';
    else if (/Safari/i.test(userAgent)) browser = 'Safari';
    else if (/Edge/i.test(userAgent)) browser = 'Edge';

    if (/Windows/i.test(userAgent)) os = 'Windows';
    else if (/Mac/i.test(userAgent)) os = 'macOS';
    else if (/Linux/i.test(userAgent)) os = 'Linux';
    else if (/Android/i.test(userAgent)) os = 'Android';
    else if (/iPhone|iPad/i.test(userAgent)) os = 'iOS';
  }

  await prisma.loginHistory.create({
    data: {
      userId,
      ipAddress: ipAddress || null,
      userAgent: userAgent?.slice(0, 500) || null,
      device,
      browser,
      os,
      success,
    },
  });
}

/**
 * Get login history for a user.
 */
export async function getLoginHistory(userId: number, limit = 20) {
  return prisma.loginHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
