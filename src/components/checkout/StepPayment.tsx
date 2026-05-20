'use client';

import { useTranslations } from 'next-intl';
import type { CheckoutInput } from '@/validators/order';
import type { PaymentMethod } from '@/types/order';
import { PAYMENT_METHOD_LABELS } from '@/types/order';
import type { CheckoutConfig } from '@/services/checkout-config';
import { useWalletAvailability } from '@/hooks/useWalletAvailability';
import TrustBadges from './TrustBadges';
import WalletQuickPay from './WalletQuickPay';

const PAYMENT_OPTIONS: { value: PaymentMethod; descriptionKey: string }[] = [
  { value: 'cod', descriptionKey: 'codDesc' },
  { value: 'bank_transfer', descriptionKey: 'bankTransferDesc' },
  { value: 'online', descriptionKey: 'onlineDesc' },
  { value: 'card_prepay', descriptionKey: 'cardPrepayDesc' },
];

type OnlineProvider =
  | 'liqpay'
  | 'liqpay_paypart'
  | 'monobank'
  | 'wayforpay'
  | 'apple_pay'
  | 'google_pay';

const ONLINE_PROVIDERS: {
  value: OnlineProvider;
  label: string;
  description: string;
  icon?: string;
  highlight?: boolean;
}[] = [
  {
    value: 'apple_pay',
    label: 'Apple Pay',
    description: 'Швидка оплата через Touch ID / Face ID',
    icon: '',
    highlight: true,
  },
  {
    value: 'google_pay',
    label: 'Google Pay',
    description: 'Швидка оплата через Google account',
    icon: 'G',
    highlight: true,
  },
  { value: 'liqpay', label: 'LiqPay', description: 'Visa / Mastercard через LiqPay (ПриватБанк)' },
  {
    value: 'liqpay_paypart',
    label: 'ПриватБанк — Оплата частинами',
    description: 'Розстрочка від ПриватБанку (без переплат для клієнта)',
  },
  { value: 'monobank', label: 'Monobank', description: 'Оплата карткою через Monobank Acquiring' },
  { value: 'wayforpay', label: 'WayForPay', description: 'Visa / Mastercard через WayForPay' },
];

interface StepPaymentProps {
  data: Partial<CheckoutInput> & { paymentProvider?: string; paymentNote?: string };
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
  config?: CheckoutConfig | null;
  cartTotal?: number;
}

export default function StepPayment({
  data,
  errors,
  onChange,
  config,
  cartTotal = 0,
}: StepPaymentProps) {
  const t = useTranslations('checkout');
  const wallet = useWalletAvailability();
  const minOnline = config?.payment.minOnlineAmount ?? null;
  const onlineBlocked = minOnline !== null && cartTotal < minOnline;

  const applePayEnabled =
    !!config?.payment.available.online.apple_pay && wallet.applePay && !onlineBlocked;
  const googlePayEnabled =
    !!config?.payment.available.online.google_pay && wallet.googlePay && !onlineBlocked;
  const hasWalletQuickPay = applePayEnabled || googlePayEnabled;

  const selectWallet = (provider: 'apple_pay' | 'google_pay') => {
    onChange('paymentMethod', 'online');
    onChange('paymentProvider', provider);
  };

  if (config?.payment.manualMode) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{t('stepPayment')}</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Опишіть, як вам зручно оплатити — менеджер уточнить деталі при підтвердженні замовлення.
        </p>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[var(--color-text)]" htmlFor="manual-payment">
            Спосіб оплати *
          </label>
          <textarea
            id="manual-payment"
            value={data.paymentNote || ''}
            onChange={(e) => onChange('paymentNote', e.target.value)}
            placeholder="Наприклад: готівкою при отриманні; на карту ПриватБанку; банківським переказом за реквізитами..."
            rows={4}
            className={`rounded-[var(--radius)] border px-3 py-2 text-sm transition-colors placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 ${
              errors.paymentNote ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
            } bg-[var(--color-bg)] text-[var(--color-text)]`}
          />
          {errors.paymentNote && (
            <p className="text-xs text-[var(--color-danger)]">{errors.paymentNote}</p>
          )}
        </div>
        <TextArea
          label={t('paymentComment')}
          value={data.comment || ''}
          onChange={(e) => onChange('comment', e.target.value)}
          error={errors.comment}
          placeholder={t('paymentCommentPlaceholder')}
        />
      </div>
    );
  }

  const visibleOptions = config
    ? PAYMENT_OPTIONS.filter((o) => {
        if (o.value === 'online') {
          if (onlineBlocked) return false;
          const o3 = config.payment.available.online;
          return (
            o3.liqpay ||
            o3.liqpay_paypart ||
            o3.monobank ||
            o3.wayforpay ||
            o3.apple_pay ||
            o3.google_pay
          );
        }
        return config.payment.available[o.value];
      })
    : PAYMENT_OPTIONS;

  const visibleProviders = config
    ? ONLINE_PROVIDERS.filter((p) => {
        if (!config.payment.available.online[p.value]) return false;
        // Hide wallet providers from radio list when shown as top quick-pay buttons
        if (hasWalletQuickPay && (p.value === 'apple_pay' || p.value === 'google_pay')) {
          return false;
        }
        return true;
      })
    : ONLINE_PROVIDERS;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t('stepPayment')}</h2>

      {onlineBlocked && (
        <div className="rounded-[var(--radius)] bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Онлайн-оплата доступна для замовлень від {minOnline?.toFixed(0)} ₴. Зараз сума замовлення
          — {cartTotal.toFixed(0)} ₴.
        </div>
      )}

      {hasWalletQuickPay && (
        <WalletQuickPay
          applePay={applePayEnabled}
          googlePay={googlePayEnabled}
          selectedProvider={data.paymentProvider}
          onSelect={selectWallet}
        />
      )}

      <div className="space-y-2">
        {hasWalletQuickPay && (
          <p className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
            Або оберіть інший спосіб
          </p>
        )}
        {visibleOptions.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border p-4 transition-colors ${
              data.paymentMethod === option.value
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
            }`}
          >
            <input
              type="radio"
              name="paymentMethod"
              value={option.value}
              checked={data.paymentMethod === option.value}
              onChange={(e) => onChange('paymentMethod', e.target.value)}
              className="mt-0.5 accent-[var(--color-primary)]"
            />
            <div>
              <span className="text-sm font-medium">{PAYMENT_METHOD_LABELS[option.value]}</span>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t(option.descriptionKey)}
              </p>
            </div>
          </label>
        ))}
        {errors.paymentMethod && (
          <p className="text-xs text-[var(--color-danger)]">{errors.paymentMethod}</p>
        )}
      </div>

      {data.paymentMethod === 'online' && visibleProviders.length > 0 && (
        <div className="space-y-2 border-t border-[var(--color-border)] pt-4">
          <p className="text-sm font-medium">{t('selectProvider')}</p>
          {visibleProviders.map((provider) => {
            const isSelected = data.paymentProvider === provider.value;
            return (
              <label
                key={provider.value}
                className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border p-3 transition-colors ${
                  isSelected
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                    : provider.highlight
                      ? 'border-black bg-black/5 hover:border-black/80'
                      : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                }`}
              >
                <input
                  type="radio"
                  name="paymentProvider"
                  value={provider.value}
                  checked={isSelected}
                  onChange={(e) => onChange('paymentProvider', e.target.value)}
                  className="mt-0.5 accent-[var(--color-primary)]"
                />
                {provider.icon && (
                  <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-black text-xs font-bold text-white">
                    {provider.icon}
                  </span>
                )}
                <div>
                  <span className="text-sm font-medium">{provider.label}</span>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {provider.description}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      )}

      <TextArea
        label={t('paymentComment')}
        value={data.comment || ''}
        onChange={(e) => onChange('comment', e.target.value)}
        error={errors.comment}
        placeholder={t('paymentCommentPlaceholder')}
      />

      <TrustBadges />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-[var(--color-text)]">{label}</label>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={3}
        className={`rounded-[var(--radius)] border px-3 py-2 text-sm transition-colors placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 ${
          error ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
        } bg-[var(--color-bg)] text-[var(--color-text)]`}
      />
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
