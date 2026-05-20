'use client';

import { useTranslations } from 'next-intl';
import type { CartItem } from '@/providers/CartProvider';
import type { CheckoutInput } from '@/validators/order';
import { DELIVERY_METHOD_LABELS, PAYMENT_METHOD_LABELS } from '@/types/order';
import type { CheckoutConfig } from '@/services/checkout-config';
import FrequentlyBought from './FrequentlyBought';

interface StepConfirmationProps {
  data: Partial<CheckoutInput> & { paymentNote?: string };
  items: CartItem[];
  total: number;
  loyaltyPoints?: number;
  loyaltyPointsToSpend?: number;
  onLoyaltyPointsChange?: (points: number) => void;
  config?: CheckoutConfig | null;
}

export default function StepConfirmation({
  data,
  items,
  total,
  loyaltyPoints,
  loyaltyPointsToSpend,
  onLoyaltyPointsChange,
  config,
}: StepConfirmationProps) {
  const t = useTranslations('checkout');
  const tc = useTranslations('common');

  const maxSpendable = Math.min(loyaltyPoints ?? 0, Math.floor(total));
  const pointsDiscount = loyaltyPointsToSpend ?? 0;
  const finalTotal = total - pointsDiscount;
  const deliveryManual = !!config?.delivery.manualMode;
  const paymentManual = !!config?.payment.manualMode;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{t('reviewOrder')}</h2>

      {/* Contact info */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] p-4">
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-secondary)]">
          {t('contactInfo')}
        </h3>
        <p className="text-sm">{data.contactName}</p>
        <p className="text-sm">{data.contactPhone}</p>
        <p className="text-sm">{data.contactEmail}</p>
        {data.companyName && (
          <p className="text-sm text-[var(--color-text-secondary)]">
            {data.companyName} {data.edrpou && `(${t('edrpou')}: ${data.edrpou})`}
          </p>
        )}
      </div>

      {/* Delivery */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] p-4">
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-secondary)]">
          {t('deliveryInfo')}
        </h3>
        {deliveryManual ? (
          <p className="whitespace-pre-wrap text-sm">{data.deliveryAddress || '—'}</p>
        ) : (
          <>
            <p className="text-sm">
              {data.deliveryMethod ? DELIVERY_METHOD_LABELS[data.deliveryMethod] : '—'}
            </p>
            {data.deliveryCity && <p className="text-sm">{data.deliveryCity}</p>}
            {data.deliveryAddress && <p className="text-sm">{data.deliveryAddress}</p>}
          </>
        )}
      </div>

      {/* Payment */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] p-4">
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-secondary)]">
          {t('paymentInfo')}
        </h3>
        {paymentManual ? (
          <p className="whitespace-pre-wrap text-sm">{data.paymentNote || '—'}</p>
        ) : (
          <p className="text-sm">
            {data.paymentMethod ? PAYMENT_METHOD_LABELS[data.paymentMethod] : '—'}
          </p>
        )}
        {data.comment && (
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {t('paymentComment')}: {data.comment}
          </p>
        )}
      </div>

      {/* Loyalty points */}
      {(loyaltyPoints ?? 0) > 0 && onLoyaltyPointsChange && (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] p-4">
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-secondary)]">
            {t('loyaltyPoints')}
          </h3>
          <p className="mb-3 text-sm">
            {t('availablePoints')}: <strong>{loyaltyPoints}</strong>
          </p>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">{t('usePoints')}:</label>
            <input
              type="number"
              min={0}
              max={maxSpendable}
              value={pointsDiscount}
              onChange={(e) => {
                const val = Math.min(Math.max(0, Number(e.target.value) || 0), maxSpendable);
                onLoyaltyPointsChange(val);
              }}
              className="w-28 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => onLoyaltyPointsChange(maxSpendable)}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              max
            </button>
          </div>
          {pointsDiscount > 0 && (
            <p className="mt-2 text-sm text-green-600">
              {t('pointsDiscount')}: -{pointsDiscount.toFixed(2)} {tc('currency')}
            </p>
          )}
        </div>
      )}

      {/* Items */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-secondary)]">
          {t('items')} ({items.length})
        </h3>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.productId} className="flex justify-between text-sm">
              <span className="flex-1">
                {item.name}{' '}
                <span className="text-[var(--color-text-secondary)]">x{item.quantity}</span>
              </span>
              <span className="font-medium">
                {(item.priceRetail * item.quantity).toFixed(2)} {tc('currency')}
              </span>
            </div>
          ))}
        </div>
        {pointsDiscount > 0 && (
          <div className="mt-2 flex justify-between text-sm text-green-600">
            <span>{t('pointsDiscount')}</span>
            <span>
              -{pointsDiscount.toFixed(2)} {tc('currency')}
            </span>
          </div>
        )}
        <div className="mt-3 flex justify-between border-t border-[var(--color-border)] pt-3 text-lg font-bold">
          <span>{tc('total')}</span>
          <span>
            {finalTotal.toFixed(2)} {tc('currency')}
          </span>
        </div>
      </div>

      <FrequentlyBought cartItems={items} limit={3} />
    </div>
  );
}
