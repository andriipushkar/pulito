'use client';

import Link from 'next/link';

interface Recommendation {
  productId: number;
  name: string;
  slug: string;
  imagePath: string | null;
  priceRetail: number;
  quantityPerMonth: number;
  totalCost: number;
  category: string;
}

interface CalculatorResultsProps {
  recommendations: Recommendation[];
  totalMonthly: number;
  totalQuarterly: number;
  onAddToCart: (productId: number, quantity: number) => void;
}

export default function CalculatorResults({ recommendations, totalMonthly, totalQuarterly, onAddToCart }: CalculatorResultsProps) {
  if (recommendations.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 text-center">
        <p className="text-[var(--color-text-secondary)]">
          На жаль, не вдалося підібрати товари. Спробуйте змінити параметри.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {recommendations.map((rec) => (
          <div
            key={rec.productId}
            className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--color-bg-light)]">
              {rec.imagePath ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={rec.imagePath} alt={rec.name} className="h-full w-full object-contain" />
              ) : (
                <span className="text-2xl text-[var(--color-text-muted)]">📦</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <Link href={`/product/${rec.slug}`} className="text-sm font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)]">
                {rec.name}
              </Link>
              <p className="text-xs text-[var(--color-text-secondary)]">{rec.category}</p>
              <div className="mt-1 flex items-center gap-3 text-xs">
                <span className="text-[var(--color-text-secondary)]">{rec.quantityPerMonth} шт/міс</span>
                <span className="font-semibold text-[var(--color-primary)]">{rec.totalCost.toFixed(2)} грн/міс</span>
              </div>
            </div>

            <button
              onClick={() => onAddToCart(rec.productId, rec.quantityPerMonth)}
              className="shrink-0 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)]"
            >
              Додати
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">Загальні витрати на місяць</p>
            <p className="text-2xl font-bold">{totalMonthly.toFixed(2)} грн</p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-90">За квартал</p>
            <p className="text-xl font-bold">{totalQuarterly.toFixed(2)} грн</p>
          </div>
        </div>
      </div>
    </div>
  );
}
