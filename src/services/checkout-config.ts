import { env } from '@/config/env';
import { getSettings } from '@/services/settings';

export interface CheckoutConfig {
  delivery: {
    manualMode: boolean;
    available: {
      nova_poshta: boolean;
      ukrposhta: boolean;
      pickup: boolean;
      pallet: boolean;
    };
    freeShippingThreshold: number | null;
    /** Fixed delivery cost per method (UAH). null = unknown / decided at order time. */
    fixedCost: {
      nova_poshta: number | null;
      ukrposhta: number | null;
    };
    pickupInfo: {
      address: string;
      hours: string;
      phone: string;
    } | null;
  };
  payment: {
    manualMode: boolean;
    minOnlineAmount: number | null;
    available: {
      cod: boolean;
      bank_transfer: boolean;
      card_prepay: boolean;
      online: {
        liqpay: boolean;
        liqpay_paypart: boolean;
        monobank: boolean;
        wayforpay: boolean;
        apple_pay: boolean;
        google_pay: boolean;
      };
    };
  };
}

function isToggleEnabled(value: string | undefined): boolean {
  return value !== 'false';
}

function present(...values: (string | undefined)[]): boolean {
  return values.every((v) => !!v && v.trim() !== '');
}

function any(...values: (string | undefined)[]): boolean {
  return values.some((v) => !!v && v.trim() !== '');
}

export async function getCheckoutConfig(): Promise<CheckoutConfig> {
  const settings = (await getSettings()) as unknown as Record<string, string | undefined>;

  // Credentials configured = present in DB OR env
  const novaPoshtaConfigured = any(settings.delivery_nova_poshta_api_key, env.NOVA_POSHTA_API_KEY);
  const ukrposhtaConfigured = any(
    settings.delivery_ukrposhta_bearer_token,
    env.UKRPOSHTA_BEARER_TOKEN,
  );
  // Payment credentials are configured ONLY in the admin panel (no env fallback).
  const liqpayConfigured = present(
    settings.payment_liqpay_public_key,
    settings.payment_liqpay_private_key,
  );
  const monobankConfigured = any(settings.payment_monobank_token);
  const wayforpayConfigured = present(
    settings.payment_wayforpay_merchant_account,
    settings.payment_wayforpay_secret_key,
  );

  // Each method available = (configured for API methods) AND (admin toggle != 'false')
  const novaPoshta = novaPoshtaConfigured && isToggleEnabled(settings.delivery_nova_poshta_enabled);
  const ukrposhta = ukrposhtaConfigured && isToggleEnabled(settings.delivery_ukrposhta_enabled);
  const pickup = isToggleEnabled(settings.delivery_pickup_enabled);
  const pallet = isToggleEnabled(settings.delivery_pallet_enabled);

  const liqpay = liqpayConfigured && isToggleEnabled(settings.payment_liqpay_enabled);
  // Paypart shares LiqPay credentials but has its own toggle (defaults OFF — owner must opt in).
  const liqpayPaypart = liqpayConfigured && settings.payment_liqpay_paypart_enabled === 'true';
  const monobank = monobankConfigured && isToggleEnabled(settings.payment_monobank_enabled);
  const wayforpay = wayforpayConfigured && isToggleEnabled(settings.payment_wayforpay_enabled);
  const cod = isToggleEnabled(settings.payment_cod_enabled);
  const bankTransfer = isToggleEnabled(settings.payment_bank_transfer_enabled);
  const cardPrepay = isToggleEnabled(settings.payment_card_prepay_enabled);

  // Apple/Google Pay route through any configured gateway (WFP preferred).
  // Default toggle ON when at least one underlying gateway is configured.
  const hasGateway = liqpayConfigured || wayforpayConfigured;
  const applePay = hasGateway && isToggleEnabled(settings.payment_apple_pay_enabled);
  const googlePay = hasGateway && isToggleEnabled(settings.payment_google_pay_enabled);

  const deliveryManual = !novaPoshta && !ukrposhta && !pickup && !pallet;
  const paymentManual =
    !liqpay &&
    !liqpayPaypart &&
    !monobank &&
    !wayforpay &&
    !applePay &&
    !googlePay &&
    !cod &&
    !bankTransfer &&
    !cardPrepay;

  const minOnlineRaw = parseFloat(settings.payment_min_online_amount ?? '');
  const minOnlineAmount = Number.isFinite(minOnlineRaw) && minOnlineRaw > 0 ? minOnlineRaw : null;
  const freeShippingRaw = parseFloat(settings.delivery_free_shipping_threshold ?? '');
  const freeShippingThreshold =
    Number.isFinite(freeShippingRaw) && freeShippingRaw > 0 ? freeShippingRaw : null;

  const pickupAddress = settings.delivery_pickup_address ?? '';
  const pickupHours = settings.delivery_pickup_hours ?? '';
  const pickupPhone = settings.delivery_pickup_phone ?? '';
  const pickupInfo =
    pickupAddress || pickupHours || pickupPhone
      ? { address: pickupAddress, hours: pickupHours, phone: pickupPhone }
      : null;

  const npFixedRaw = parseFloat(settings.delivery_nova_poshta_fixed_cost ?? '');
  const upFixedRaw = parseFloat(settings.delivery_ukrposhta_fixed_cost ?? '');
  const fixedCost = {
    nova_poshta: Number.isFinite(npFixedRaw) && npFixedRaw > 0 ? npFixedRaw : null,
    ukrposhta: Number.isFinite(upFixedRaw) && upFixedRaw > 0 ? upFixedRaw : null,
  };

  return {
    delivery: {
      manualMode: deliveryManual,
      available: {
        nova_poshta: novaPoshta,
        ukrposhta,
        pickup,
        pallet,
      },
      freeShippingThreshold,
      fixedCost,
      pickupInfo,
    },
    payment: {
      manualMode: paymentManual,
      minOnlineAmount,
      available: {
        cod,
        bank_transfer: bankTransfer,
        card_prepay: cardPrepay,
        online: {
          liqpay,
          liqpay_paypart: liqpayPaypart,
          monobank,
          wayforpay,
          apple_pay: applePay,
          google_pay: googlePay,
        },
      },
    },
  };
}
