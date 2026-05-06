import { env } from '@/config/env';
import { getSettings } from '@/services/settings';

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

export async function getNovaPoshtaCreds() {
  const s = await load();
  return { apiKey: pick(s.delivery_nova_poshta_api_key, env.NOVA_POSHTA_API_KEY) };
}

export async function getUkrposhtaCreds() {
  const s = await load();
  return { bearerToken: pick(s.delivery_ukrposhta_bearer_token, env.UKRPOSHTA_BEARER_TOKEN) };
}

export async function getLiqPayCreds() {
  const s = await load();
  return {
    publicKey: pick(s.payment_liqpay_public_key, env.LIQPAY_PUBLIC_KEY),
    privateKey: pick(s.payment_liqpay_private_key, env.LIQPAY_PRIVATE_KEY),
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
  return { token: pick(s.payment_monobank_token, env.MONOBANK_TOKEN) };
}

export async function getWayForPayCreds() {
  const s = await load();
  return {
    merchantAccount: pick(s.payment_wayforpay_merchant_account, env.WAYFORPAY_MERCHANT_ACCOUNT),
    secretKey: pick(s.payment_wayforpay_secret_key, env.WAYFORPAY_SECRET_KEY),
  };
}
