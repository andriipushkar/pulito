import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { generateSecret, generateOtpauthUrl, encryptSecret } from '@/services/totp';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { privateResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import QRCode from 'qrcode';

/**
 * POST /api/v1/auth/2fa/setup
 * Generates a new TOTP secret for the authenticated admin/manager user.
 * Returns secret, otpauth URL, and QR code as data URL.
 */
// 2FA is available to all authenticated users — both staff and customers.
// Previously this was gated to admin/manager which broke the storefront
// security tab in the customer cabinet.
export const POST = withRole(
  'admin',
  'manager',
  'client',
  'wholesaler',
)(async (request, { user }) => {
  try {
    // Setup is cheap-ish but allocates a TOTP secret + QR PNG; cap per-user
    // so a stuck UI loop or stolen session can't loop the endpoint, rotating
    // secrets and clearing the 30-min TTL repeatedly.
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.sensitive);
    if (!rl.allowed) return errorResponse('Забагато спроб налаштування 2FA', 429);

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, twoFactorEnabled: true },
    });

    if (!dbUser) {
      return errorResponse('Користувача не знайдено', 404);
    }

    if (dbUser.twoFactorEnabled) {
      return errorResponse('Двофакторна автентифікація вже увімкнена', 400);
    }

    const secret = generateSecret();
    const otpauthUrl = generateOtpauthUrl(secret, dbUser.email);

    // Generate QR code as data URL (no external service needed)
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
      width: 250,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    // Store secret (not yet enabled) with a 30-minute cleanup timer.
    // If the user abandons setup, the unverified secret will be cleared
    // automatically — preventing indefinite persistence of unused secrets.
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: encryptSecret(secret), twoFactorEnabled: false },
    });

    // Set a 30-minute TTL — if not verified, clear the secret
    const { redis } = await import('@/lib/redis');
    const ttlKey = `2fa_setup_ttl:${user.id}`;
    await redis.set(ttlKey, secret, 'EX', 1800); // 30 minutes

    // Audit secret generation so the security timeline starts here, not at
    // verify. If the secret is later leaked, the audit row tells us when
    // setup was initiated and from where.
    await logAudit({
      userId: user.id,
      actionType: 'user_edit',
      entityType: 'user',
      entityId: user.id,
      details: { action: '2fa_setup_initiated' },
      ipAddress: getClientIp(request),
    });

    return privateResponse({ secret, otpauthUrl, qrDataUrl });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
