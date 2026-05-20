import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { invalidateSettingsCache } from '@/services/settings';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption';

const PAYMENT_SETTINGS_KEYS = [
  'payment_liqpay_enabled',
  'payment_liqpay_public_key',
  'payment_liqpay_private_key',
  'payment_liqpay_sandbox',
  'payment_liqpay_paypart_enabled',
  'payment_liqpay_paypart_count',
  'payment_apple_pay_enabled',
  'payment_google_pay_enabled',
  'payment_monobank_enabled',
  'payment_monobank_token',
  'payment_wayforpay_enabled',
  'payment_wayforpay_merchant_account',
  'payment_wayforpay_secret_key',
  'payment_cod_enabled',
  'payment_bank_transfer_enabled',
  'payment_bank_transfer_details',
  'payment_card_prepay_enabled',
  'payment_card_prepay_details',
  'payment_min_online_amount',
] as const;

// Anything that, if leaked, lets an attacker forge payments or impersonate
// the merchant for refunds. We include IBAN/card-prepay details — although
// not signing material, they often expose internal banking workflow and
// frequently include account numbers, IBAN, EDRPOU.
const SENSITIVE_KEYS = [
  'payment_liqpay_private_key',
  'payment_monobank_token',
  'payment_wayforpay_secret_key',
  'payment_bank_transfer_details',
  'payment_card_prepay_details',
];

/**
 * Decrypt-then-mask flow: secrets at rest are encrypted (see PUT below).
 * GET decrypts them so masking can show the first/last 4 chars of the actual
 * key — masking the ciphertext directly would expose nothing useful.
 * Legacy plain-text values still in DB pass through unchanged until next PUT.
 */
function decryptIfNeeded(value: string): string {
  if (!value) return value;
  if (isEncrypted(value)) {
    try {
      return decrypt(value);
    } catch {
      // Decryption failed — log and return the raw stored value so the
      // admin can see something rather than a blank field.
      return value;
    }
  }
  return value;
}

function maskValue(key: string, rawValue: string): string {
  if (!SENSITIVE_KEYS.includes(key) || !rawValue) return rawValue;
  const value = decryptIfNeeded(rawValue);
  if (value.length < 8) return value;
  return value.slice(0, 4) + '••••••••' + value.slice(-4);
}

export const GET = withRole2fa(
  'admin',
  'manager',
)(async () => {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: [...PAYMENT_SETTINGS_KEYS] } },
    });

    const result: Record<string, string> = {};
    for (const key of PAYMENT_SETTINGS_KEYS) {
      const setting = settings.find((s) => s.key === key);
      result[key] = setting ? maskValue(key, setting.value) : '';
    }

    return successResponse(result);
  } catch (err) {
    logger.error('[admin/payment-settings] GET failed', { error: err });
    return errorResponse('Помилка завантаження налаштувань', 500);
  }
});

export const PUT = withRole2fa('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const changedKeys: string[] = [];
    const sensitiveChangedKeys: string[] = [];

    for (const [key, value] of Object.entries(body)) {
      if (!PAYMENT_SETTINGS_KEYS.includes(key as (typeof PAYMENT_SETTINGS_KEYS)[number])) continue;

      const strValue = String(value);
      // Don't overwrite with masked value
      if (SENSITIVE_KEYS.includes(key) && strValue.includes('••••')) continue;

      // Encrypt sensitive values at rest. The encryption helper uses
      // AES-256-GCM with a key derived from APP_SECRET — DB leak no longer
      // surrenders payment credentials.
      const storedValue = SENSITIVE_KEYS.includes(key) ? encrypt(strValue) : strValue;

      await prisma.siteSetting.upsert({
        where: { key },
        update: { value: storedValue, updatedBy: user.id },
        create: { key, value: storedValue, updatedBy: user.id },
      });
      if (SENSITIVE_KEYS.includes(key)) sensitiveChangedKeys.push(key);
      else changedKeys.push(key);
    }

    await invalidateSettingsCache();

    if (changedKeys.length || sensitiveChangedKeys.length) {
      await logAudit({
        userId: user.id,
        actionType: 'rule_change',
        entityType: 'settings',
        details: { scope: 'payment', changedKeys, sensitiveChangedKeys },
        ipAddress: getClientIp(request),
      });
    }
    return successResponse({ saved: true });
  } catch (err) {
    logger.error('[admin/payment-settings] PUT failed', { error: err });
    return errorResponse('Помилка збереження налаштувань', 500);
  }
});
