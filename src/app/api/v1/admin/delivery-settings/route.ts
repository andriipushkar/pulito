import { NextRequest } from 'next/server';
import { withRole, withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { invalidateSettingsCache } from '@/services/settings';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption';

const DELIVERY_SETTINGS_KEYS = [
  'delivery_nova_poshta_enabled',
  'delivery_nova_poshta_api_key',
  'delivery_nova_poshta_sender_ref',
  'delivery_nova_poshta_sender_city_ref',
  'delivery_nova_poshta_sender_warehouse_ref',
  'delivery_nova_poshta_sender_phone',
  'delivery_ukrposhta_enabled',
  'delivery_ukrposhta_bearer_token',
  'delivery_ukrposhta_sender_name',
  'delivery_ukrposhta_sender_phone',
  'delivery_ukrposhta_sender_address',
  'delivery_pickup_enabled',
  'delivery_pickup_address',
  'delivery_pickup_hours',
  'delivery_pickup_phone',
  'delivery_free_shipping_threshold',
  'delivery_nova_poshta_fixed_cost',
  'delivery_ukrposhta_fixed_cost',
] as const;

const SENSITIVE_KEYS = ['delivery_nova_poshta_api_key', 'delivery_ukrposhta_bearer_token'];

function maskValue(key: string, rawValue: string): string {
  if (!SENSITIVE_KEYS.includes(key) || !rawValue) return rawValue;
  let value = rawValue;
  if (isEncrypted(rawValue)) {
    try {
      value = decrypt(rawValue);
    } catch {
      value = rawValue;
    }
  }
  if (value.length < 8) return value;
  return value.slice(0, 4) + '••••••••' + value.slice(-4);
}

// GET also reads decrypted API keys (then masks). Promote to withRole2fa to
// match PUT and prevent a session hijack via a manager account from
// silently revealing the masked-but-still-leaky prefix/suffix.
export const GET = withRole2fa(
  'admin',
  'manager',
)(async () => {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: [...DELIVERY_SETTINGS_KEYS] } },
    });

    const result: Record<string, string> = {};
    for (const key of DELIVERY_SETTINGS_KEYS) {
      const setting = settings.find((s) => s.key === key);
      result[key] = setting ? maskValue(key, setting.value) : '';
    }

    return successResponse(result);
  } catch (err) {
    logger.error('[admin/delivery-settings] GET failed', { error: err });
    return errorResponse('Помилка завантаження налаштувань', 500);
  }
});

export const PUT = withRole2fa('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const changedKeys: string[] = [];
    const sensitiveChangedKeys: string[] = [];

    for (const [key, value] of Object.entries(body)) {
      if (!DELIVERY_SETTINGS_KEYS.includes(key as (typeof DELIVERY_SETTINGS_KEYS)[number]))
        continue;

      const strValue = String(value);
      if (SENSITIVE_KEYS.includes(key) && strValue.includes('••••')) continue;

      // Numeric fields must not be negative. We use string storage but
      // validate the value parses as a positive decimal before saving.
      if (
        key.endsWith('_fixed_cost') ||
        key === 'delivery_free_shipping_threshold'
      ) {
        const num = parseFloat(strValue);
        if (strValue && (!Number.isFinite(num) || num < 0)) {
          return errorResponse(
            `Поле "${key}" має бути додатним числом (отримано "${strValue}")`,
            400,
          );
        }
      }

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
        details: { scope: 'delivery', changedKeys, sensitiveChangedKeys },
        ipAddress: getClientIp(request),
      });
    }
    return successResponse({ saved: true });
  } catch (err) {
    logger.error('[admin/delivery-settings] PUT failed', { error: err });
    return errorResponse('Помилка збереження налаштувань', 500);
  }
});
