import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
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
  // Free-text reference the admin maintains by hand (NP doesn't expose account
  // balance / monthly TTN quota via its public API). Shown to the team on the
  // delivery-settings screen; not read by any runtime delivery logic.
  'delivery_nova_poshta_balance_note',
  'delivery_ukrposhta_enabled',
  'delivery_ukrposhta_bearer_token',
  // Counterparty/user token — required as ?token= on every eCom call except
  // /addresses (clients, shipments, groups, printing). Sensitive.
  'delivery_ukrposhta_counterparty_token',
  'delivery_ukrposhta_sender_name',
  'delivery_ukrposhta_sender_phone',
  'delivery_ukrposhta_sender_address',
  // Structured sender address for eCom shipment creation (address-classifier
  // fields). Used to build the shop's sender client when no UUID is cached.
  'delivery_ukrposhta_sender_postcode',
  'delivery_ukrposhta_sender_region',
  'delivery_ukrposhta_sender_city',
  'delivery_ukrposhta_sender_street',
  'delivery_ukrposhta_sender_house',
  // Cached sender client UUID — skips re-creating the sender on each shipment.
  'delivery_ukrposhta_sender_client_uuid',
  'delivery_pickup_enabled',
  'delivery_pickup_address',
  'delivery_pickup_hours',
  'delivery_pickup_phone',
  'delivery_free_shipping_threshold',
  'delivery_nova_poshta_fixed_cost',
  'delivery_ukrposhta_fixed_cost',
] as const;

const SENSITIVE_KEYS = [
  'delivery_nova_poshta_api_key',
  'delivery_ukrposhta_bearer_token',
  'delivery_ukrposhta_counterparty_token',
];

function maskValue(key: string, rawValue: string, leakyOk: boolean): string {
  if (!SENSITIVE_KEYS.includes(key) || !rawValue) return rawValue;
  let value = rawValue;
  if (isEncrypted(rawValue)) {
    try {
      value = decrypt(rawValue);
    } catch {
      value = rawValue;
    }
  }
  // Admins get the full "first4••••last4" mask — useful for confirming which
  // key is currently saved before rotating. Managers get a fully opaque
  // mask: they shouldn't be able to fingerprint the key by its edges if
  // their session is hijacked.
  if (!leakyOk) return value ? '••••••••' : '';
  if (value.length < 8) return value;
  return value.slice(0, 4) + '••••••••' + value.slice(-4);
}

export const GET = withRole2fa(
  'admin',
  'manager',
)(async (_request, { user }) => {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: [...DELIVERY_SETTINGS_KEYS] } },
    });

    const isAdmin = user.role === 'admin';
    const result: Record<string, string> = {};
    for (const key of DELIVERY_SETTINGS_KEYS) {
      const setting = settings.find((s) => s.key === key);
      result[key] = setting ? maskValue(key, setting.value, isAdmin) : '';
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
    const confirmClearSensitive = body.__confirmClearSensitive === true;
    const changedKeys: string[] = [];
    const sensitiveChangedKeys: string[] = [];

    // Same guard as payment-settings PUT: refuse to clear an existing
    // credential unless the client explicitly opted in. Accidentally
    // submitting an empty NP key would silently break checkout otherwise.
    const wouldClearSensitive: string[] = [];
    for (const [key, value] of Object.entries(body)) {
      if (!SENSITIVE_KEYS.includes(key)) continue;
      const strValue = String(value ?? '');
      if (strValue !== '' || strValue.includes('••••')) continue;
      const existing = await prisma.siteSetting.findUnique({ where: { key } });
      if (existing && existing.value && existing.value.length > 0) {
        wouldClearSensitive.push(key);
      }
    }
    if (wouldClearSensitive.length > 0 && !confirmClearSensitive) {
      return errorResponse(
        `Поля ${wouldClearSensitive.join(', ')} будуть очищені, що вимкне доставку через відповідного провайдера. ` +
          `Якщо це навмисно — повторіть з прапором __confirmClearSensitive: true.`,
        422,
      );
    }

    // Drop stale cache BEFORE writes so any concurrent reader is forced to
    // re-hit the DB during the save window (rather than serving cached
    // pre-write data). The trailing invalidate below catches anything that
    // managed to repopulate the cache mid-loop.
    await invalidateSettingsCache();

    for (const [key, value] of Object.entries(body)) {
      if (key === '__confirmClearSensitive') continue;
      if (!DELIVERY_SETTINGS_KEYS.includes(key as (typeof DELIVERY_SETTINGS_KEYS)[number]))
        continue;

      const strValue = String(value);
      if (SENSITIVE_KEYS.includes(key) && strValue.includes('••••')) continue;

      // Numeric fields must not be negative. We use string storage but
      // validate the value parses as a positive decimal before saving.
      if (key.endsWith('_fixed_cost') || key === 'delivery_free_shipping_threshold') {
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

    // Bracket the cache-invalidate around the upsert window. Calling it
    // BEFORE the writes means any in-flight reads racing the save get a
    // fresh DB hit; calling it AFTER clears the freshly-populated cache
    // entries written during the upsert. Without the leading call, a
    // request landing 1ms before the trailing `invalidateSettingsCache()`
    // could repopulate cache with stale post-write value and outlive the
    // invalidation.
    await invalidateSettingsCache();

    if (changedKeys.length || sensitiveChangedKeys.length) {
      await logAudit({
        userId: user.id,
        actionType: 'rule_change',
        entityType: 'settings',
        details: {
          scope: 'delivery',
          changedKeys,
          sensitiveChangedKeys,
          ...(wouldClearSensitive.length > 0 ? { clearedSensitive: wouldClearSensitive } : {}),
        },
        ipAddress: getClientIp(request),
      });
    }
    return successResponse({ saved: true });
  } catch (err) {
    logger.error('[admin/delivery-settings] PUT failed', { error: err });
    return errorResponse('Помилка збереження налаштувань', 500);
  }
});
