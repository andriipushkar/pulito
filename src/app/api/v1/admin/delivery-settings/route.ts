import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

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

const SENSITIVE_KEYS = [
  'delivery_nova_poshta_api_key',
  'delivery_ukrposhta_bearer_token',
];

function maskValue(key: string, value: string): string {
  if (!SENSITIVE_KEYS.includes(key) || !value || value.length < 8) return value;
  return value.slice(0, 4) + '••••••••' + value.slice(-4);
}

export const GET = withRole('admin', 'manager')(async () => {
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
  } catch {
    return errorResponse('Помилка завантаження налаштувань', 500);
  }
});

export const PUT = withRole('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();

    for (const [key, value] of Object.entries(body)) {
      if (!DELIVERY_SETTINGS_KEYS.includes(key as typeof DELIVERY_SETTINGS_KEYS[number])) continue;

      const strValue = String(value);
      if (SENSITIVE_KEYS.includes(key) && strValue.includes('••••')) continue;

      await prisma.siteSetting.upsert({
        where: { key },
        update: { value: strValue, updatedBy: user.id },
        create: { key, value: strValue, updatedBy: user.id },
      });
    }

    return successResponse({ saved: true });
  } catch {
    return errorResponse('Помилка збереження налаштувань', 500);
  }
});
