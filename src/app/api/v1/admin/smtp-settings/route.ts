import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

const SMTP_KEYS = [
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_pass',
  'smtp_from',
  'smtp_from_name',
  'smtp_secure',
  'max_file_size_mb',
] as const;

const SENSITIVE_KEYS = ['smtp_pass'];

function maskValue(key: string, value: string): string {
  if (!SENSITIVE_KEYS.includes(key) || !value || value.length < 6) return value;
  return value.slice(0, 3) + '••••••' + value.slice(-3);
}

export const GET = withRole('admin', 'manager')(async () => {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: [...SMTP_KEYS] } },
    });

    const result: Record<string, string> = {};
    for (const key of SMTP_KEYS) {
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
      if (!SMTP_KEYS.includes(key as typeof SMTP_KEYS[number])) continue;
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
    return errorResponse('Помилка збереження', 500);
  }
});
