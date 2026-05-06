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

import { getCheckoutConfig } from './checkout-config';

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

describe('getCheckoutConfig — manual mode triggers', () => {
  it('fresh install (no env, no toggles) → both delivery & payment in manual mode', async () => {
    const config = await getCheckoutConfig();
    expect(config.delivery.manualMode).toBe(false); // pickup/pallet default ON
    expect(config.payment.manualMode).toBe(false); // cod/bank/prepay default ON
  });

  it('all delivery toggles disabled → delivery manual mode', async () => {
    settingsMock.value = {
      delivery_pickup_enabled: 'false',
      delivery_pallet_enabled: 'false',
    };
    const config = await getCheckoutConfig();
    expect(config.delivery.manualMode).toBe(true);
    expect(config.delivery.available.pickup).toBe(false);
    expect(config.delivery.available.pallet).toBe(false);
  });

  it('all payment toggles disabled + no online providers → payment manual mode', async () => {
    settingsMock.value = {
      payment_cod_enabled: 'false',
      payment_bank_transfer_enabled: 'false',
      payment_card_prepay_enabled: 'false',
    };
    const config = await getCheckoutConfig();
    expect(config.payment.manualMode).toBe(true);
  });
});

describe('getCheckoutConfig — env vs DB credentials priority', () => {
  it('NP available when env key set', async () => {
    envMock.NOVA_POSHTA_API_KEY = 'env-key';
    const config = await getCheckoutConfig();
    expect(config.delivery.available.nova_poshta).toBe(true);
  });

  it('NP available when DB key set (env empty)', async () => {
    settingsMock.value = { delivery_nova_poshta_api_key: 'db-key' };
    const config = await getCheckoutConfig();
    expect(config.delivery.available.nova_poshta).toBe(true);
  });

  it('NP unavailable when DB toggle is explicitly false', async () => {
    envMock.NOVA_POSHTA_API_KEY = 'env-key';
    settingsMock.value = { delivery_nova_poshta_enabled: 'false' };
    const config = await getCheckoutConfig();
    expect(config.delivery.available.nova_poshta).toBe(false);
  });

  it('LiqPay requires BOTH public and private keys', async () => {
    envMock.LIQPAY_PUBLIC_KEY = 'pub';
    // private missing
    const config = await getCheckoutConfig();
    expect(config.payment.available.online.liqpay).toBe(false);
  });

  it('LiqPay public from DB + private from env', async () => {
    envMock.LIQPAY_PRIVATE_KEY = 'env-priv';
    settingsMock.value = { payment_liqpay_public_key: 'db-pub' };
    const config = await getCheckoutConfig();
    expect(config.payment.available.online.liqpay).toBe(true);
  });
});

describe('getCheckoutConfig — paypart toggle', () => {
  it('paypart defaults OFF even when LiqPay configured', async () => {
    envMock.LIQPAY_PUBLIC_KEY = 'pub';
    envMock.LIQPAY_PRIVATE_KEY = 'priv';
    const config = await getCheckoutConfig();
    expect(config.payment.available.online.liqpay).toBe(true);
    expect(config.payment.available.online.liqpay_paypart).toBe(false);
  });

  it('paypart enabled when toggle = "true" AND LiqPay configured', async () => {
    envMock.LIQPAY_PUBLIC_KEY = 'pub';
    envMock.LIQPAY_PRIVATE_KEY = 'priv';
    settingsMock.value = { payment_liqpay_paypart_enabled: 'true' };
    const config = await getCheckoutConfig();
    expect(config.payment.available.online.liqpay_paypart).toBe(true);
  });

  it('paypart impossible without LiqPay even if toggle on', async () => {
    settingsMock.value = { payment_liqpay_paypart_enabled: 'true' };
    const config = await getCheckoutConfig();
    expect(config.payment.available.online.liqpay_paypart).toBe(false);
  });
});

describe('getCheckoutConfig — apple/google pay availability', () => {
  it('apple_pay requires any gateway (LiqPay or WFP)', async () => {
    const config1 = await getCheckoutConfig();
    expect(config1.payment.available.online.apple_pay).toBe(false);

    envMock.WAYFORPAY_MERCHANT_ACCOUNT = 'merch';
    envMock.WAYFORPAY_SECRET_KEY = 'sec';
    const config2 = await getCheckoutConfig();
    expect(config2.payment.available.online.apple_pay).toBe(true);
    expect(config2.payment.available.online.google_pay).toBe(true);
  });

  it('apple_pay can be disabled via toggle', async () => {
    envMock.WAYFORPAY_MERCHANT_ACCOUNT = 'merch';
    envMock.WAYFORPAY_SECRET_KEY = 'sec';
    settingsMock.value = { payment_apple_pay_enabled: 'false' };
    const config = await getCheckoutConfig();
    expect(config.payment.available.online.apple_pay).toBe(false);
  });
});

describe('getCheckoutConfig — pickupInfo & freeShippingThreshold', () => {
  it('pickupInfo null when no pickup settings', async () => {
    const config = await getCheckoutConfig();
    expect(config.delivery.pickupInfo).toBeNull();
  });

  it('pickupInfo populated when admin set address', async () => {
    settingsMock.value = {
      delivery_pickup_address: 'м. Київ, вул. Хрещатик 1',
      delivery_pickup_hours: '9-18',
      delivery_pickup_phone: '+380501234567',
    };
    const config = await getCheckoutConfig();
    expect(config.delivery.pickupInfo).toEqual({
      address: 'м. Київ, вул. Хрещатик 1',
      hours: '9-18',
      phone: '+380501234567',
    });
  });

  it('freeShippingThreshold parsed from settings', async () => {
    settingsMock.value = { delivery_free_shipping_threshold: '2000' };
    const config = await getCheckoutConfig();
    expect(config.delivery.freeShippingThreshold).toBe(2000);
  });

  it('freeShippingThreshold null on invalid value', async () => {
    settingsMock.value = { delivery_free_shipping_threshold: 'not-a-number' };
    const config = await getCheckoutConfig();
    expect(config.delivery.freeShippingThreshold).toBeNull();
  });

  it('minOnlineAmount parsed from settings', async () => {
    settingsMock.value = { payment_min_online_amount: '100' };
    const config = await getCheckoutConfig();
    expect(config.payment.minOnlineAmount).toBe(100);
  });
});
