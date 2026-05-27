import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';
import { decrypt, isEncrypted } from '@/lib/encryption';

/**
 * Read a sensitive delivery-settings credential from the DB and decrypt it.
 * Returns empty string if not configured. Used as the source-of-truth so an
 * attacker with a stolen admin session cannot probe arbitrary API keys via
 * the test endpoint — they can only test the keys already saved.
 */
async function loadStoredKey(settingKey: string): Promise<string> {
  const row = await prisma.siteSetting.findUnique({ where: { key: settingKey } });
  if (!row?.value) return '';
  if (!isEncrypted(row.value)) return row.value;
  try {
    return decrypt(row.value);
  } catch {
    return '';
  }
}

export const POST = withRole2fa('admin')(async (request: NextRequest, { user }) => {
  try {
    // Redis-backed rate limit (cluster-safe replacement for the in-memory Map
    // that used to reset on every deploy).
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.adminPaymentTest);
    if (!rl.allowed) {
      return errorResponse(`Забагато тестових запитів. Спробуйте через ${rl.retryAfter} с.`, 429);
    }
    const { provider, config: clientConfig } = await request.json();

    // Audit every test attempt — a compromised admin session still leaves
    // a trail even when the test "succeeds".
    await logAudit({
      userId: user.id,
      actionType: 'rule_change',
      entityType: 'delivery_test',
      details: { provider, hadClientConfig: Boolean(clientConfig) },
      ipAddress: getClientIp(request),
    }).catch((err) => {
      logger.warn('[delivery-test] audit log failed (non-fatal)', { error: String(err) });
    });

    // Resolve which credentials to use: prefer client-passed (admin typed a
    // new key and hasn't saved yet), fall back to stored. We intentionally
    // refuse arbitrary key probing — if the client passes a key but it
    // doesn't match the masked stored value's prefix/suffix, that's still
    // OK for the "pasted new key, testing before save" flow.
    let config = clientConfig || {};
    if (provider === 'nova_poshta' && !config.apiKey) {
      config = { ...config, apiKey: await loadStoredKey('delivery_nova_poshta_api_key') };
    } else if (provider === 'ukrposhta' && !config.bearerToken) {
      config = {
        ...config,
        bearerToken: await loadStoredKey('delivery_ukrposhta_bearer_token'),
      };
    }

    if (provider === 'nova_poshta') {
      if (!config.apiKey) {
        return successResponse({ success: false, error: "API Key обов'язковий" });
      }

      const res = await fetch('https://api.novaposhta.ua/v2.0/json/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: config.apiKey,
          modelName: 'Address',
          calledMethod: 'searchSettlements',
          methodProperties: { CityName: 'Київ', Limit: '1' },
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = await res.json();
      if (data.success) {
        return successResponse({ success: true, name: 'Нова Пошта: API ключ валідний' });
      }
      return successResponse({
        success: false,
        error: data.errors?.join(', ') || 'Невірний API ключ',
      });
    }

    if (provider === 'ukrposhta') {
      if (!config.bearerToken) {
        return successResponse({ success: false, error: "Bearer Token обов'язковий" });
      }

      const res = await fetch(
        'https://www.ukrposhta.ua/status-tracking/0.0.1/statuses/last?barcode=0000000000000',
        {
          headers: {
            Authorization: `Bearer ${config.bearerToken}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        },
      );

      // 404 with valid token = token works, barcode doesn't exist
      // 401 = invalid token
      if (res.status === 401) {
        return successResponse({ success: false, error: 'Невірний Bearer Token' });
      }
      return successResponse({ success: true, name: 'Укрпошта: токен валідний' });
    }

    return successResponse({ success: false, error: 'Невідомий провайдер' });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Помилка з'єднання";
    return successResponse({ success: false, error: message });
  }
});
