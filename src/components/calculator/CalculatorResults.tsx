'use client';

import Link from 'next/link';
import Image from 'next/image';

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

interface RoomResultData {
  roomType: string;
  roomLabel: string;
  count: number;
  area: number;
  products: Recommendation[];
  monthlyCost: number;
}

interface CalculatorResultsProps {
  /** Legacy flat list of recommendations (step-less calculator) */
  recommendations?: Recommendation[];
  /** Room-based results */
  roomResults?: RoomResultData[];
  totalMonthly: number;
  totalQuarterly?: number;
  onAddToCart: (productId: number, quantity: number) => void;
  onAddAllToCart?: () => void;
}

function ProductRow({
  rec,
  onAddToCart,
}: {
  rec: Recommendation;
  onAddToCart: (productId: number, quantity: number) => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--color-bg-light)]">
        {rec.imagePath ? (
          <Image src={rec.imagePath} alt={rec.name} fill sizes="64px" className="object-contain" />
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
  );
}

export default function CalculatorResults({
  recommendations,
  roomResults,
  totalMonthly,
  totalQuarterly,
  onAddToCart,
  onAddAllToCart,
}: CalculatorResultsProps) {
  const hasRoomResults = roomResults && roomResults.length > 0;
  const hasLegacy = recommendations && recommendations.length > 0;

  if (!hasRoomResults && !hasLegacy) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 text-center">
        <p className="text-[var(--color-text-secondary)]">
          На жаль, не вдалося підібрати товари. Спробуйте змінити параметри.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Room-based breakdown */}
      {hasRoomResults &&
        roomResults.map((room) => (
          <div key={room.roomType} data-testid={`room-result-${room.roomType}`}>
            <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-[var(--color-text)]">
              {room.roomLabel}
              {room.count > 1 && <span className="text-sm font-normal text-[var(--color-text-secondary)]">x{room.count}</span>}
              <span className="ml-auto text-sm font-semibold text-[var(--color-primary)]">
                {room.monthlyCost.toFixed(2)} грн/міс
              </span>
            </h3>
            <div className="grid gap-3">
              {room.products.map((rec) => (
                <ProductRow key={rec.productId} rec={rec} onAddToCart={onAddToCart} />
              ))}
              {room.products.length === 0 && (
                <p className="text-sm text-[var(--color-text-secondary)]">Товари для цієї кімнати не знайдені</p>
              )}
            </div>
          </div>
        ))}

      {/* Legacy flat list */}
      {!hasRoomResults && hasLegacy && (
        <div className="grid gap-3">
          {recommendations.map((rec) => (
            <ProductRow key={rec.productId} rec={rec} onAddToCart={onAddToCart} />
          ))}
        </div>
      )}

      {/* Total cost summary */}
      <div data-testid="total-cost" className="rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">Загальні витрати на місяць</p>
            <p className="text-2xl font-bold">{totalMonthly.toFixed(2)} грн</p>
          </div>
          {totalQuarterly !== undefined && (
            <div className="text-right">
              <p className="text-sm opacity-90">За квартал</p>
              <p className="text-xl font-bold">{totalQuarterly.toFixed(2)} грн</p>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {onAddAllToCart && (
          <button
            data-testid="add-all-to-cart"
            onClick={onAddAllToCart}
            className="flex-1 rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--color-primary-dark)]"
          >
            Додати все в кошик
          </button>
        )}
        <button
          data-testid="download-pdf"
          onClick={() => {
            // Placeholder for PDF generation
            window.alert('Функція завантаження PDF буде доступна незабаром.');
          }}
          className="rounded-xl border border-[var(--color-border)] px-6 py-3 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-secondary)]"
        >
          Завантажити PDF
        </button>
      </div>
    </div>
  );
}
