'use client';

import { useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { apiClient } from '@/lib/api-client';

interface CartSummaryProps {
  itemCount: number;
  total: number;
  isCheckoutDisabled?: boolean;
  disabledReason?: string;
  freeShippingThreshold?: number | null;
}

interface AppliedCoupon {
  code: string;
  discount: number;
  description?: string;
}

const COUPON_STORAGE_KEY = 'pulito-cart-coupon';

function loadCoupon(): AppliedCoupon | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COUPON_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppliedCoupon) : null;
  } catch {
    return null;
  }
}

function saveCoupon(coupon: AppliedCoupon | null) {
  try {
    if (coupon) localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(coupon));
    else localStorage.removeItem(COUPON_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export default function CartSummary({
  itemCount,
  total,
  isCheckoutDisabled,
  disabledReason,
  freeShippingThreshold,
}: CartSummaryProps) {
  const fst = freeShippingThreshold ?? 0;
  const showFreeShipping = fst > 0;
  const remaining = Math.max(0, fst - total);
  const reached = showFreeShipping && total >= fst;
  const progress = showFreeShipping ? Math.min(100, (total / fst) * 100) : 0;

  // Coupon state
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(() => loadCoupon());
  const [showCouponField, setShowCouponField] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  const applyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const res = await apiClient.post<{
        couponId: number;
        code: string;
        type: string;
        discount: number;
        description?: string;
      }>('/api/v1/coupons/validate', { code: couponInput.trim(), orderAmount: total });
      if (res.success && res.data) {
        const c: AppliedCoupon = {
          code: res.data.code,
          discount: res.data.discount,
          description: res.data.description,
        };
        setCoupon(c);
        saveCoupon(c);
        setCouponInput('');
        setShowCouponField(false);
      } else {
        setCouponError(res.error || 'Промокод недійсний');
      }
    } catch {
      setCouponError('Помилка перевірки промокоду');
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setCoupon(null);
    saveCoupon(null);
    setCouponError(null);
  };

  const finalTotal = Math.max(0, total - (coupon?.discount || 0));

  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
      <h2 className="mb-4 text-lg font-semibold">Разом</h2>

      <div className="space-y-3 border-b border-[var(--color-border)] pb-4">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--color-text-secondary)]">Товарів: {itemCount}</span>
          <span>{total.toFixed(2)} ₴</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--color-text-secondary)]">Доставка</span>
          <span className="text-[var(--color-text-secondary)]">
            {reached ? (
              <span className="font-semibold text-green-600">безкоштовно</span>
            ) : (
              'за тарифами перевізника'
            )}
          </span>
        </div>
        {showFreeShipping && (
          <div className="space-y-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
              <div
                className={`h-full transition-all ${
                  reached ? 'bg-green-500' : 'bg-[var(--color-primary)]'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {reached
                ? 'Безкоштовна доставка вам нараховується'
                : `Додайте ще ${Math.ceil(remaining)} ₴ для безкоштовної доставки`}
            </p>
          </div>
        )}
        {coupon && (
          <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-green-800">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
              </svg>
              <span>
                <strong className="font-mono">{coupon.code}</strong>
                {coupon.description && (
                  <span className="ml-1 text-xs text-green-700">— {coupon.description}</span>
                )}
              </span>
            </span>
            <button
              type="button"
              onClick={removeCoupon}
              className="text-xs font-medium text-green-700 hover:underline"
            >
              Прибрати
            </button>
          </div>
        )}
        {!coupon &&
          (showCouponField ? (
            <div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                  placeholder="Введіть промокод"
                  className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm font-mono uppercase outline-none focus:border-[var(--color-primary)]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={couponLoading || !couponInput.trim()}
                  className="shrink-0 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
                >
                  {couponLoading ? '…' : 'Застосувати'}
                </button>
              </div>
              {couponError && (
                <p className="mt-1.5 text-xs text-[var(--color-danger)]">{couponError}</p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCouponField(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Маю промокод
            </button>
          ))}
        {coupon && coupon.discount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-text-secondary)]">Знижка</span>
            <span className="font-semibold text-green-600">−{coupon.discount.toFixed(2)} ₴</span>
          </div>
        )}
      </div>

      <div className="flex justify-between py-4 text-lg font-bold">
        <span>До сплати</span>
        <span>{finalTotal.toFixed(2)} ₴</span>
      </div>

      {disabledReason && (
        <p className="mb-3 text-xs text-[var(--color-danger)]">{disabledReason}</p>
      )}

      <Link href="/checkout">
        <Button size="lg" className="w-full" disabled={isCheckoutDisabled}>
          Оформити замовлення
        </Button>
      </Link>

      <Link
        href="/catalog"
        className="mt-3 block text-center text-sm text-[var(--color-primary)] hover:underline"
      >
        Продовжити покупки
      </Link>
    </div>
  );
}
