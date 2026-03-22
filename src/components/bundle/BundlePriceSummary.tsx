interface BundlePriceSummaryProps {
  originalPrice: number;
  finalPrice: number;
  savings: number;
  className?: string;
}

export default function BundlePriceSummary({
  originalPrice,
  finalPrice,
  savings,
  className = '',
}: BundlePriceSummaryProps) {
  const discountPercent = originalPrice > 0
    ? Math.round(((originalPrice - finalPrice) / originalPrice) * 100)
    : 0;
  const hasDiscount = savings > 0;

  return (
    <div className={`rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] p-5 ${className}`}>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
        Підсумок цін
      </h3>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-secondary)]">Сума товарів окремо</span>
          <span className={hasDiscount ? 'text-[var(--color-text-secondary)] line-through' : 'font-semibold text-[var(--color-text)]'}>
            {originalPrice.toFixed(2)} ₴
          </span>
        </div>

        {hasDiscount && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-text-secondary)]">Знижка комплекту</span>
              <span className="font-medium text-[#4CAF50]">
                -{discountPercent}% ({savings.toFixed(2)} ₴)
              </span>
            </div>
            <div className="border-t border-[var(--color-border)]/60 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-[var(--color-text)]">Ціна комплекту</span>
                <span className="text-xl font-bold text-[var(--color-primary)]">
                  {finalPrice.toFixed(2)} ₴
                </span>
              </div>
            </div>
          </>
        )}

        {!hasDiscount && (
          <div className="border-t border-[var(--color-border)]/60 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-[var(--color-text)]">Ціна комплекту</span>
              <span className="text-xl font-bold text-[var(--color-text)]">
                {finalPrice.toFixed(2)} ₴
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
