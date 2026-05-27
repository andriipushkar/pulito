import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { invalidateSmtpConfigCache } from '@/services/smtp-config';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption';
import { updateSmtpSettingsSchema } from '@/validators/smtp';

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

function maskValue(key: string, rawValue: string): string {
  if (!SENSITIVE_KEYS.includes(key) || !rawValue) return rawValue;
  // Decrypt before masking so the first/last chars belong to the real
  // password (masking ciphertext is meaningless to the admin).
  let value = rawValue;
  if (isEncrypted(rawValue)) {
    try {
      value = decrypt(rawValue);
    } catch {
      value = rawValue;
    }
  }
  if (value.length < 6) return value;
  return value.slice(0, 3) + '••••••' + value.slice(-3);
}

export const GET = withRole2fa(
  'admin',
  'manager',
)(async () => {
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
  } catch (err) {
    logger.error('[admin/smtp-settings] GET failed', { error: err });
    return errorResponse('Помилка завантаження налаштувань', 500);
  }
});

export const PUT = withRole2fa('admin')(async (request: NextRequest, { user }) => {
  try {
    const rawBody = await request.json();
    const parsed = updateSmtpSettingsSchema.safeParse(rawBody);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const body = parsed.data;

    // Before-snapshot of non-secret keys so audit can show what changed
    // (smtp_host hijack to attacker server must leave a trail with the
    // old hostname). Sensitive `smtp_pass` is never logged — only "changed".
    const beforeSettings = await prisma.siteSetting.findMany({
      where: { key: { in: [...SMTP_KEYS] } },
    });
    const before: Record<string, string> = {};
    for (const s of beforeSettings) {
      if (SENSITIVE_KEYS.includes(s.key)) continue;
      before[s.key] = s.value;
    }

    const changedKeys: string[] = [];
    const sensitiveChangedKeys: string[] = [];

    for (const [key, value] of Object.entries(body)) {
      if (!SMTP_KEYS.includes(key as (typeof SMTP_KEYS)[number])) continue;
      if (value === undefined) continue;
      const strValue = String(value);
      if (SENSITIVE_KEYS.includes(key) && strValue.includes('••••')) continue;

      // Encrypt sensitive values at rest (AES-256-GCM, key derived from APP_SECRET).
      const storedValue = SENSITIVE_KEYS.includes(key) ? encrypt(strValue) : strValue;

      await prisma.siteSetting.upsert({
        where: { key },
        update: { value: storedValue, updatedBy: user.id },
        create: { key, value: storedValue, updatedBy: user.id },
      });
      if (SENSITIVE_KEYS.includes(key)) sensitiveChangedKeys.push(key);
      else changedKeys.push(key);
    }

    invalidateSmtpConfigCache();

    if (changedKeys.length || sensitiveChangedKeys.length) {
      await logAudit({
        userId: user.id,
        actionType: 'rule_change',
        entityType: 'settings',
        details: { scope: 'smtp', changedKeys, sensitiveChangedKeys, before },
        ipAddress: getClientIp(request),
      });
    }
    return successResponse({ saved: true });
  } catch (err) {
    logger.error('[admin/smtp-settings] PUT failed', { error: err });
    return errorResponse('Помилка збереження', 500);
  }
});
