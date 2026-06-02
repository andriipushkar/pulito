import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { invalidateSettingsCache } from '@/services/settings';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger, setLogLevel } from '@/lib/logger';
import { DEFAULT_SETTINGS } from '@/types/settings';

// Keys that grant access to third-party services. We mask the tail of the
// value before returning so an admin reading the page (or its HTML cache)
// can't be casually leaked an API key. PUT-side still accepts the masked
// value as a no-op so saving the form back doesn't overwrite the real key.
const SENSITIVE_SETTING_KEYS = new Set([
  'google_maps_api_key',
  'google_analytics_id',
  'facebook_pixel_id',
  'pinterest_tag_id',
  'tiktok_pixel_id',
  'hotjar_id',
  'sendpulse_api_key',
  'sendpulse_api_secret',
  'recaptcha_secret_key',
  'anthropic_api_key',
  'gemini_api_key',
  'removebg_api_key',
]);

// Whitelist of keys this endpoint will accept on PUT. Other key namespaces
// (payment_*, smtp_*, delivery_*, marketplace_*, bot_*, channel_*) have
// their own dedicated routes with encryption/2FA. Accepting arbitrary keys
// here would let a compromised admin write to those without going through
// the right validation path.
// Дозволені ключі автоматично беремо з DEFAULT_SETTINGS — це єдиний
// source of truth для загальних налаштувань. Раніше тут був ручний список
// з розходженнями (work_hours vs working_hours, facebook_url vs
// social_facebook тощо), через які PUT мовчки падав з 400 на першому ж
// "неправильному" ключі і нічого не зберігалося.
const ALLOWED_SETTING_KEYS = new Set<string>(Object.keys(DEFAULT_SETTINGS));

function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 4) return '••••';
  return `${'•'.repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`;
}

export const GET = withRole2fa('admin')(async () => {
  try {
    const settings = await prisma.siteSetting.findMany({
      orderBy: { key: 'asc' },
    });
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = SENSITIVE_SETTING_KEYS.has(s.key) ? maskSecret(s.value) : s.value;
    }
    return successResponse(map);
  } catch (err) {
    logger.error('[admin/settings] GET failed', { error: err });
    return errorResponse('Помилка завантаження налаштувань', 500);
  }
});

function formatPhoneDisplay(phone: string): string {
  const match = phone.match(/^\+380(\d{2})(\d{3})(\d{2})(\d{2})$/);
  if (!match) return phone;
  return `+38 (0${match[1]}) ${match[2]}-${match[3]}-${match[4]}`;
}

export const PUT = withRole2fa('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = (await request.json()) as Record<string, string>;
    // Derive the display variant whenever the raw phone is updated, so the
    // public-facing text (TopBar/Header/Footer) tracks the click-to-call value.
    if (typeof body.site_phone === 'string' && body.site_phone_display === undefined) {
      body.site_phone_display = formatPhoneDisplay(body.site_phone);
    }
    const entries = Object.entries(body) as [string, string][];

    // Snapshot prior values of non-sensitive keys for audit diffing.
    // Sensitive values are never written into audit — only their key names.
    const keys = entries.map(([k]) => k);
    const beforeRows = await prisma.siteSetting.findMany({
      where: { key: { in: keys } },
    });
    const before: Record<string, string> = {};
    for (const r of beforeRows) {
      if (SENSITIVE_SETTING_KEYS.has(r.key)) continue;
      before[r.key] = r.value;
    }

    // Numeric keys that must stay non-negative — same reason as
    // free_delivery_threshold/min_order_amount; reject `-X` typos before
    // they corrupt the storefront calculator.
    const NON_NEGATIVE_NUMERIC_KEYS = new Set([
      'free_delivery_threshold',
      'min_order_amount',
      'reviews_min_length',
      'reviews_max_length',
      'max_file_size_mb',
      'session_timeout_minutes',
    ]);

    // Self-lockout guard: a non-empty admin IP whitelist that omits the
    // caller's own IP would immediately bounce them out of /admin (proxy.ts).
    // Reject the save with a clear message unless the caller is on a local IP
    // (on-box) or already in the list they're submitting.
    if (typeof body.admin_allowed_ips === 'string' && body.admin_allowed_ips.trim()) {
      const callerIp = getClientIp(request);
      const LOCAL_IPS = new Set(['127.0.0.1', '::1', 'localhost', '']);
      const list = body.admin_allowed_ips
        .split(',')
        .map((ip) => ip.trim())
        .filter(Boolean);
      if (!LOCAL_IPS.has(callerIp) && !list.includes(callerIp)) {
        return errorResponse(
          `Додайте свою поточну IP (${callerIp || 'невідома'}) до списку, інакше втратите доступ до адмінки`,
          400,
        );
      }
    }

    for (const [key, value] of entries) {
      if (!ALLOWED_SETTING_KEYS.has(key)) {
        return errorResponse(`Ключ "${key}" не дозволено в загальних налаштуваннях`, 400);
      }
      const str = String(value);
      // Treat fully-masked submissions of sensitive keys as no-ops so the
      // admin can save the form without scrubbing the real secret away.
      if (SENSITIVE_SETTING_KEYS.has(key) && /^•+/.test(str)) continue;

      if (NON_NEGATIVE_NUMERIC_KEYS.has(key)) {
        const n = Number(str);
        if (Number.isFinite(n) && n < 0) {
          return errorResponse(`${key}: значення не може бути від’ємним`, 400);
        }
      }

      await prisma.siteSetting.upsert({
        where: { key },
        update: { value: str, updatedBy: user.id },
        create: { key, value: str, updatedBy: user.id },
      });
    }

    await invalidateSettingsCache();

    // Apply log level live so the change takes effect without a restart.
    if (typeof body.log_level === 'string' && body.log_level) {
      setLogLevel(body.log_level);
    }

    // Settings feed the storefront layout (TopBar, Header, Footer); without
    // this, ISR keeps serving cached HTML until each route's revalidate window.
    revalidatePath('/', 'layout');

    if (entries.length) {
      await logAudit({
        userId: user.id,
        actionType: 'rule_change',
        entityType: 'settings',
        details: {
          scope: 'general',
          changedKeys: entries.map(([k]) => k),
          // Pre-fix diff — non-sensitive values only. Sensitive secret
          // changes are observable by presence of the key in `changedKeys`.
          before,
        },
        ipAddress: getClientIp(request),
      });
    }
    return successResponse({ updated: entries.length });
  } catch (err) {
    logger.error('[admin/settings] PUT failed', { error: err });
    return errorResponse('Помилка збереження налаштувань', 500);
  }
});
