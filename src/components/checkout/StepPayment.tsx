'use client';

import { useTranslations } from 'next-intl';
import type { CheckoutInput } from '@/validators/order';
import type { PaymentMethod } from '@/types/order';
import { PAYMENT_METHOD_LABELS } from '@/types/order';

const PAYMENT_OPTIONS: { value: PaymentMethod; descriptionKey: string }[] = [
  { value: 'cod', descriptionKey: 'codDesc' },
  { value: 'bank_transfer', descriptionKey: 'bankTransferDesc' },
  { value: 'online', descriptionKey: 'onlineDesc' },
  { value: 'card_prepay', descriptionKey: 'cardPrepayDesc' },
];

const ONLINE_PROVIDERS = [
  { value: 'liqpay', label: 'LiqPay', descriptionKey: 'liqpayDesc' },
  { value: 'monobank', label: 'Monobank', descriptionKey: 'monobankDesc' },
  { value: 'wayforpay', label: 'WayForPay', descriptionKey: 'wayforpayDesc' },
];

interface StepPaymentProps {
  data: Partial<CheckoutInput> & { paymentProvider?: string };
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
}

export default function StepPayment({ data, errors, onChange }: StepPaymentProps) {
  const t = useTranslations('checkout');

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t('stepPayment')}</h2>

      <div className="space-y-2">
        {PAYMENT_OPTIONS.map((option) => (
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
              <p className="text-xs text-[var(--color-text-secondary)]">{t(option.descriptionKey)}</p>
            </div>
          </label>
        ))}
        {errors.paymentMethod && (
          <p className="text-xs text-[var(--color-danger)]">{errors.paymentMethod}</p>
        )}
      </div>

      {data.paymentMethod === 'online' && (
        <div className="space-y-2 border-t border-[var(--color-border)] pt-4">
          <p className="text-sm font-medium">{t('selectProvider')}</p>
          {ONLINE_PROVIDERS.map((provider) => (
            <label
              key={provider.value}
              className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border p-3 transition-colors ${
                data.paymentProvider === provider.value
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                  : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
              }`}
            >
              <input
                type="radio"
                name="paymentProvider"
                value={provider.value}
                checked={data.paymentProvider === provider.value}
                onChange={(e) => onChange('paymentProvider', e.target.value)}
                className="mt-0.5 accent-[var(--color-primary)]"
              />
              <div>
                <span className="text-sm font-medium">{provider.label}</span>
                <p className="text-xs text-[var(--color-text-secondary)]">{t(provider.descriptionKey)}</p>
              </div>
            </label>
          ))}
        </div>
      )}

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

function TextArea({ label, value, onChange, error, placeholder }: {
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
