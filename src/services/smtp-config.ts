import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { decrypt, isEncrypted } from '@/lib/encryption';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fromName: string;
}

const SMTP_KEYS = [
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_pass',
  'smtp_from',
  'smtp_from_name',
  'smtp_secure',
] as const;

const CACHE_TTL_MS = 60_000;
let cache: { data: SmtpConfig; expires: number } | null = null;

/**
 * Returns SMTP config from SiteSetting with env fallback per field.
 * Admin-UI values take precedence; env is used while a key is empty/unset.
 */
export async function getSmtpConfig(): Promise<SmtpConfig> {
  if (cache && Date.now() < cache.expires) return cache.data;

  let map: Record<string, string> = {};
  try {
    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: [...SMTP_KEYS] } },
    });
    map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    // DB down — fall through to env-only
  }

  const host = map.smtp_host?.trim() || env.SMTP_HOST;
  const portRaw = map.smtp_port?.trim();
  const port = portRaw && /^\d+$/.test(portRaw) ? Number(portRaw) : Number(env.SMTP_PORT);
  const user = map.smtp_user?.trim() || env.SMTP_USER;
  // smtp_pass is stored encrypted at rest (see /api/v1/admin/smtp-settings).
  // Decrypt at use so nodemailer receives plaintext; fall back to env when
  // unset or unparseable.
  const rawPass = map.smtp_pass?.trim() || '';
  let pass = rawPass || env.SMTP_PASS;
  if (rawPass && isEncrypted(rawPass)) {
    try {
      pass = decrypt(rawPass);
    } catch {
      pass = env.SMTP_PASS;
    }
  }
  const from = map.smtp_from?.trim() || env.SMTP_FROM;
  const fromName = map.smtp_from_name?.trim() || 'Pulito Trade';
  const secureRaw = map.smtp_secure?.trim();
  // Explicit override wins; otherwise SMTPS port 465 implies secure connection.
  const secure = secureRaw === 'true' ? true : secureRaw === 'false' ? false : port === 465;

  const config: SmtpConfig = { host, port, secure, user, pass, from, fromName };
  cache = { data: config, expires: Date.now() + CACHE_TTL_MS };
  return config;
}

export function invalidateSmtpConfigCache(): void {
  cache = null;
}
