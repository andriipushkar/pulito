import { describe, it, expect, vi, beforeEach } from 'vitest';

const envMock = vi.hoisted(() => ({
  NOVA_POSHTA_API_KEY: '',
  UKRPOSHTA_BEARER_TOKEN: '',
  LIQPAY_PUBLIC_KEY: '',
  LIQPAY_PRIVATE_KEY: '',
  MONOBANK_TOKEN: '',
  WAYFORPAY_MERCHANT_ACCOUNT: '',
  WAYFORPAY_SECRET_KEY: '',
}));

const settingsMock = vi.hoisted(() => ({ value: {} as Record<string, string> }));

vi.mock('@/config/env', () => ({ env: envMock }));
vi.mock('@/services/settings', () => ({
  getSettings: vi.fn(async () => ({ ...settingsMock.value })),
}));

import {
  getNovaPoshtaCreds,
  getUkrposhtaCreds,
  getLiqPayCreds,
  getMonobankCreds,
  getWayForPayCreds,
} from './integration-credentials';

beforeEach(() => {
  Object.assign(envMock, {
    NOVA_POSHTA_API_KEY: '',
    UKRPOSHTA_BEARER_TOKEN: '',
    LIQPAY_PUBLIC_KEY: '',
    LIQPAY_PRIVATE_KEY: '',
    MONOBANK_TOKEN: '',
    WAYFORPAY_MERCHANT_ACCOUNT: '',
    WAYFORPAY_SECRET_KEY: '',
  });
  settingsMock.value = {};
});

describe('credential resolution — DB > env priority', () => {
  it('NP returns DB value when both DB and env are set', async () => {
    envMock.NOVA_POSHTA_API_KEY = 'env-key';
    settingsMock.value = { delivery_nova_poshta_api_key: 'db-key' };
    const r = await getNovaPoshtaCreds();
    expect(r.apiKey).toBe('db-key');
  });

  it('NP falls back to env when DB empty', async () => {
    envMock.NOVA_POSHTA_API_KEY = 'env-key';
    const r = await getNovaPoshtaCreds();
    expect(r.apiKey).toBe('env-key');
  });

  it('NP returns empty when neither set', async () => {
    const r = await getNovaPoshtaCreds();
    expect(r.apiKey).toBe('');
  });

  it('NP treats whitespace-only DB value as empty', async () => {
    envMock.NOVA_POSHTA_API_KEY = 'env-key';
    settingsMock.value = { delivery_nova_poshta_api_key: '   ' };
    const r = await getNovaPoshtaCreds();
    expect(r.apiKey).toBe('env-key');
  });

  it('Ukrposhta uses bearerToken field', async () => {
    settingsMock.value = { delivery_ukrposhta_bearer_token: 'tok' };
    const r = await getUkrposhtaCreds();
    expect(r.bearerToken).toBe('tok');
  });

  it('Mono returns token from env when DB empty', async () => {
    envMock.MONOBANK_TOKEN = 'env-tok';
    const r = await getMonobankCreds();
    expect(r.token).toBe('env-tok');
  });

  it('WayForPay returns both account and secret', async () => {
    envMock.WAYFORPAY_MERCHANT_ACCOUNT = 'env-acc';
    settingsMock.value = { payment_wayforpay_secret_key: 'db-sec' };
    const r = await getWayForPayCreds();
    expect(r.merchantAccount).toBe('env-acc');
    expect(r.secretKey).toBe('db-sec');
  });
});

describe('LiqPay extra fields — sandbox + paypartCount', () => {
  it('sandbox=true when DB toggle is "true"', async () => {
    settingsMock.value = { payment_liqpay_sandbox: 'true' };
    const r = await getLiqPayCreds();
    expect(r.sandbox).toBe(true);
  });

  it('sandbox=false by default', async () => {
    const r = await getLiqPayCreds();
    expect(r.sandbox).toBe(false);
  });

  it('paypartCount defaults to 3 when unset', async () => {
    const r = await getLiqPayCreds();
    expect(r.paypartCount).toBe(3);
  });

  it('paypartCount parses valid number', async () => {
    settingsMock.value = { payment_liqpay_paypart_count: '6' };
    const r = await getLiqPayCreds();
    expect(r.paypartCount).toBe(6);
  });

  it('paypartCount falls back to 3 on out-of-range value (< 2)', async () => {
    settingsMock.value = { payment_liqpay_paypart_count: '1' };
    const r = await getLiqPayCreds();
    expect(r.paypartCount).toBe(3);
  });

  it('paypartCount falls back on out-of-range (> 24)', async () => {
    settingsMock.value = { payment_liqpay_paypart_count: '25' };
    const r = await getLiqPayCreds();
    expect(r.paypartCount).toBe(3);
  });

  it('paypartCount falls back on garbage value', async () => {
    settingsMock.value = { payment_liqpay_paypart_count: 'six' };
    const r = await getLiqPayCreds();
    expect(r.paypartCount).toBe(3);
  });
});

describe('graceful failure when settings unavailable', () => {
  it('falls back to env when getSettings throws', async () => {
    const { getSettings } = await import('@/services/settings');
    vi.mocked(getSettings).mockRejectedValueOnce(new Error('DB down'));
    envMock.NOVA_POSHTA_API_KEY = 'env-only';
    const r = await getNovaPoshtaCreds();
    expect(r.apiKey).toBe('env-only');
  });
});
