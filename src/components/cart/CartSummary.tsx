'use client';

import Link from 'next/link';
import Button from '@/components/ui/Button';

interface CartSummaryProps {
  itemCount: number;
  total: number;
  isCheckoutDisabled?: boolean;
  disabledReason?: string;
  freeShippingThreshold?: number | null;
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
                : `Додайте ще ${remaining.toFixed(0)} ₴ для безкоштовної доставки`}
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between py-4 text-lg font-bold">
        <span>До сплати</span>
        <span>{total.toFixed(2)} ₴</span>
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
