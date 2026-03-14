import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

const PAYMENT_SETTINGS_KEYS = [
  'payment_liqpay_enabled',
  'payment_liqpay_public_key',
  'payment_liqpay_private_key',
  'payment_liqpay_sandbox',
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

const SENSITIVE_KEYS = [
  'payment_liqpay_private_key',
  'payment_monobank_token',
  'payment_wayforpay_secret_key',
];

function maskValue(key: string, value: string): string {
  if (!SENSITIVE_KEYS.includes(key) || !value || value.length < 8) return value;
  return value.slice(0, 4) + '••••••••' + value.slice(-4);
}

export const GET = withRole('admin', 'manager')(async () => {
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
  } catch {
    return errorResponse('Помилка завантаження налаштувань', 500);
  }
});

export const PUT = withRole('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();

    for (const [key, value] of Object.entries(body)) {
      if (!PAYMENT_SETTINGS_KEYS.includes(key as typeof PAYMENT_SETTINGS_KEYS[number])) continue;

      const strValue = String(value);
      // Don't overwrite with masked value
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
