import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { invalidateSettingsCache } from '@/services/settings';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption';

/**
 * Hash sensitive credential values for the audit trail. We store SHA-256
 * fingerprints, not the values themselves — gives reviewers enough to
 * detect "value changed" / "value reverted" / "silently emptied" without
 * leaking the credential into the audit log.
 */
function hashForAudit(value: string): string {
  return value
    ? `sha256:${crypto.createHash('sha256').update(value).digest('hex').slice(0, 16)}`
    : 'empty';
}

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
    const confirmClearSensitive = body.__confirmClearSensitive === true;
    const changedKeys: string[] = [];
    const sensitiveChangedKeys: string[] = [];

    // Guard: detect sensitive credentials that would be CLEARED (set to empty
    // string) by this save. Without the explicit confirmClearSensitive flag,
    // refuse — otherwise a stray click on "Save" with an empty input
    // silently disables LiqPay/Mono/WayForPay and the operator only notices
    // when conversion drops to zero.
    const wouldClearSensitive: string[] = [];
    for (const [key, value] of Object.entries(body)) {
      if (!SENSITIVE_KEYS.includes(key)) continue;
      const strValue = String(value ?? '');
      if (strValue !== '' || strValue.includes('••••')) continue;
      // Empty — check if there's currently a non-empty stored value.
      const existing = await prisma.siteSetting.findUnique({ where: { key } });
      if (existing && existing.value && existing.value.length > 0) {
        wouldClearSensitive.push(key);
      }
    }
    if (wouldClearSensitive.length > 0 && !confirmClearSensitive) {
      return errorResponse(
        `Поля ${wouldClearSensitive.join(', ')} будуть очищені, що вимкне відповідного провайдера. ` +
          `Якщо це навмисно — повторіть з прапором __confirmClearSensitive: true.`,
        422,
      );
    }

    // Capture before/after hashes for sensitive keys so audit reviewers can
    // see at a glance whether a value actually changed, was cleared, or was
    // saved as the same value (e.g. a re-paste of an already-saved cred).
    const sensitiveHashDiff: Record<string, { before: string; after: string }> = {};

    for (const [key, value] of Object.entries(body)) {
      if (key === '__confirmClearSensitive') continue;
      if (!PAYMENT_SETTINGS_KEYS.includes(key as (typeof PAYMENT_SETTINGS_KEYS)[number])) continue;

      const strValue = String(value);
      // Don't overwrite with masked value
      if (SENSITIVE_KEYS.includes(key) && strValue.includes('••••')) continue;

      // Encrypt sensitive values at rest. The encryption helper uses
      // AES-256-GCM with a key derived from APP_SECRET — DB leak no longer
      // surrenders payment credentials.
      const storedValue = SENSITIVE_KEYS.includes(key) ? encrypt(strValue) : strValue;

      if (SENSITIVE_KEYS.includes(key)) {
        const existing = await prisma.siteSetting.findUnique({ where: { key } });
        const beforePlain = existing?.value ? decryptIfNeeded(existing.value) : '';
        sensitiveHashDiff[key] = {
          before: hashForAudit(beforePlain),
          after: hashForAudit(strValue),
        };
      }

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
        details: {
          scope: 'payment',
          changedKeys,
          sensitiveChangedKeys,
          // before/after SHA-256 fingerprints (16 hex chars) for sensitive
          // keys — lets reviewers tell "value rotated" from "value emptied"
          // without exposing the value itself.
          ...(Object.keys(sensitiveHashDiff).length > 0 ? { sensitiveHashDiff } : {}),
          // Marker so audit reviewers see the explicit clear-sensitive action.
          ...(wouldClearSensitive.length > 0 ? { clearedSensitive: wouldClearSensitive } : {}),
        },
        ipAddress: getClientIp(request),
      });
    }
    return successResponse({ saved: true });
  } catch (err) {
    logger.error('[admin/payment-settings] PUT failed', { error: err });
    return errorResponse('Помилка збереження налаштувань', 500);
  }
});
