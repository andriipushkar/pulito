import { env } from '@/config/env';
import { getSettings } from '@/services/settings';
import { decrypt, isEncrypted } from '@/lib/encryption';
import { logger } from '@/lib/logger';

async function load(): Promise<Record<string, string | undefined>> {
  try {
    return (await getSettings()) as unknown as Record<string, string | undefined>;
  } catch {
    return {};
  }
}

function pick(dbValue: string | undefined, envValue: string): string {
  return dbValue && dbValue.trim() !== '' ? dbValue : envValue;
}

/**
 * Non-sensitive admin-only value (e.g. LiqPay public key, WayForPay merchant
 * account). Stored as plain text in `siteSetting`; we just normalise empty/
 * whitespace to ''. No env fallback — payment credentials live ONLY in the
 * admin panel (admin → Налаштування оплати).
 */
function dbPlain(dbValue: string | undefined): string {
  return dbValue && dbValue.trim() !== '' ? dbValue : '';
}

/**
 * Sensitive admin-only secret (LiqPay private key, Monobank token, WayForPay
 * secret key). These are encrypted at rest by the payment-settings PUT route,
 * so they must be decrypted here before use — otherwise the provider receives
 * ciphertext and every signature fails. Legacy plain-text values (saved before
 * at-rest encryption existed) pass through unchanged. No env fallback.
 */
function dbSecret(dbValue: string | undefined): string {
  if (!dbValue || dbValue.trim() === '') return '';
  if (isEncrypted(dbValue)) {
    try {
      return decrypt(dbValue);
    } catch (err) {
      logger.error('[integration-credentials] failed to decrypt payment secret', {
        error: err instanceof Error ? err.message : String(err),
      });
      return '';
    }
  }
  return dbValue; // legacy plain-text value, not yet re-saved through encryption
}

export async function getNovaPoshtaCreds() {
  const s = await load();
  return { apiKey: pick(s.delivery_nova_poshta_api_key, env.NOVA_POSHTA_API_KEY) };
}

// Default sender city ref (Kyiv) — used for delivery cost/date estimates when
// the shop hasn't set its own city in admin → Налаштування доставки. The Lviv
// shop, for example, should configure delivery_nova_poshta_sender_city_ref so
// estimates are computed from the real origin, not Kyiv.
const DEFAULT_NP_SENDER_CITY_REF = '8d5a980d-391c-11dd-90d9-001a92567626';

export async function getNovaPoshtaSenderCityRef(): Promise<string> {
  const s = await load();
  return pick(s.delivery_nova_poshta_sender_city_ref, DEFAULT_NP_SENDER_CITY_REF);
}

export async function getUkrposhtaCreds() {
  const s = await load();
  return {
    bearerToken: pick(s.delivery_ukrposhta_bearer_token, env.UKRPOSHTA_BEARER_TOKEN),
    counterpartyToken: pick(
      s.delivery_ukrposhta_counterparty_token,
      env.UKRPOSHTA_COUNTERPARTY_TOKEN,
    ),
  };
}

export async function getLiqPayCreds() {
  const s = await load();
  return {
    publicKey: dbPlain(s.payment_liqpay_public_key),
    privateKey: dbSecret(s.payment_liqpay_private_key),
    sandbox: s.payment_liqpay_sandbox === 'true',
    paypartCount: parseInstalmentCount(s.payment_liqpay_paypart_count),
  };
}

function parseInstalmentCount(value: string | undefined): number {
  const n = parseInt(value ?? '', 10);
  if (Number.isFinite(n) && n >= 2 && n <= 24) return n;
  return 3;
}

export async function getMonobankCreds() {
  const s = await load();
  return { token: dbSecret(s.payment_monobank_token) };
}

export async function getWayForPayCreds() {
  const s = await load();
  return {
    merchantAccount: dbPlain(s.payment_wayforpay_merchant_account),
    secretKey: dbSecret(s.payment_wayforpay_secret_key),
  };
}

/**
 * 1C/BAS ERP credentials. Currently the 1C integration uses ApiKey-based
 * auth (1C sends `Authorization: Bearer <our key>` to our endpoints), so
 * there's no outbound credential to store. This stub exists so when a
 * future 1C OData/web-service flow needs OUTBOUND credentials, the keys
 * land here — encrypted at rest via the same `siteSetting` layer — instead
 * of being added as one-off plaintext envs.
 */
export async function get1CCreds() {
  const s = await load();
  return {
    // Reserved keys for future outbound 1C calls (e.g. fetching the 1C
    // "Управление торговлей" OData feed). Empty by default.
    apiUrl: s.integration_1c_api_url || '',
    apiUser: s.integration_1c_api_user || '',
    apiPassword: s.integration_1c_api_password || '',
  };
}
