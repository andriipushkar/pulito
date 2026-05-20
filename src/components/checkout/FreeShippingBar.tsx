'use client';

interface FreeShippingBarProps {
  threshold: number;
  cartTotal: number;
}

export default function FreeShippingBar({ threshold, cartTotal }: FreeShippingBarProps) {
  const delta = Math.max(threshold - cartTotal, 0);
  const reached = delta === 0;
  const progress = Math.min(cartTotal / threshold, 1);

  return (
    <div
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3"
      aria-live="polite"
    >
      <div className="mb-2 flex items-center justify-between text-xs">
        {reached ? (
          <span className="font-medium text-emerald-700">
            ✓ Безкоштовна доставка
          </span>
        ) : (
          <>
            <span className="text-[var(--color-text-secondary)]">До безкоштовної доставки</span>
            <span className="font-semibold text-[var(--color-text)]">
              {delta.toFixed(0)} ₴
            </span>
          </>
        )}
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            reached ? 'bg-emerald-500' : 'bg-[var(--color-primary)]'
          }`}
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  );
}
