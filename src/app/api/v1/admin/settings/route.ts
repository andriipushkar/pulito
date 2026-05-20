import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { invalidateSettingsCache } from '@/services/settings';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

// Keys that grant access to third-party services. We mask the tail of the
// value before returning so an admin reading the page (or its HTML cache)
// can't be casually leaked an API key. PUT-side still accepts the masked
// value as a no-op so saving the form back doesn't overwrite the real key.
const SENSITIVE_SETTING_KEYS = new Set([
  'google_maps_api_key',
  'google_analytics_id',
  'facebook_pixel_id',
  'tiktok_pixel_id',
  'hotjar_id',
  'sendpulse_api_key',
  'sendpulse_api_secret',
  'recaptcha_secret_key',
]);

// Whitelist of keys this endpoint will accept on PUT. Other key namespaces
// (payment_*, smtp_*, delivery_*, marketplace_*, bot_*, channel_*) have
// their own dedicated routes with encryption/2FA. Accepting arbitrary keys
// here would let a compromised admin write to those without going through
// the right validation path.
const ALLOWED_SETTING_KEYS = new Set([
  'site_name',
  'site_tagline',
  'site_description',
  'site_phone',
  'site_phone_display',
  'site_email',
  'site_address',
  'site_logo',
  'site_favicon',
  'site_og_image',
  'site_meta_keywords',
  'work_hours',
  'free_delivery_threshold',
  'min_order_amount',
  'max_root_categories',
  'currency',
  'currency_symbol',
  'google_maps_api_key',
  'google_analytics_id',
  'facebook_pixel_id',
  'tiktok_pixel_id',
  'hotjar_id',
  'sendpulse_api_key',
  'sendpulse_api_secret',
  'recaptcha_site_key',
  'recaptcha_secret_key',
  'facebook_url',
  'instagram_url',
  'youtube_url',
  'telegram_url',
  'viber_url',
  'tiktok_url',
  'maintenance_mode',
  'maintenance_message',
]);

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

    for (const [key, value] of entries) {
      if (!ALLOWED_SETTING_KEYS.has(key)) {
        return errorResponse(`Ключ "${key}" не дозволено в загальних налаштуваннях`, 400);
      }
      const str = String(value);
      // Treat fully-masked submissions of sensitive keys as no-ops so the
      // admin can save the form without scrubbing the real secret away.
      if (SENSITIVE_SETTING_KEYS.has(key) && /^•+/.test(str)) continue;

      // Reject negative numerics for fields whose semantics require non-neg.
      if (key === 'free_delivery_threshold' || key === 'min_order_amount') {
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
    // Settings feed the storefront layout (TopBar, Header, Footer); without
    // this, ISR keeps serving cached HTML until each route's revalidate window.
    revalidatePath('/', 'layout');

    if (entries.length) {
      await logAudit({
        userId: user.id,
        actionType: 'rule_change',
        entityType: 'settings',
        details: { scope: 'general', changedKeys: entries.map(([k]) => k) },
        ipAddress: getClientIp(request),
      });
    }
    return successResponse({ updated: entries.length });
  } catch (err) {
    logger.error('[admin/settings] PUT failed', { error: err });
    return errorResponse('Помилка збереження налаштувань', 500);
  }
});
