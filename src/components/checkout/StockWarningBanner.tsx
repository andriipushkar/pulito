'use client';

import { useCart } from '@/hooks/useCart';
import { useCartStockValidation } from '@/hooks/useCartStockValidation';
import { Alert } from '@/components/icons';

export default function StockWarningBanner() {
  const { items, updateQuantity, removeItem } = useCart();
  const { issues } = useCartStockValidation(items);

  if (issues.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="mb-4 rounded-[var(--radius)] border border-amber-300 bg-amber-50 p-4 text-amber-900"
    >
      <div className="mb-2 flex items-center gap-2">
        <Alert size={18} className="shrink-0 text-amber-700" />
        <p className="text-sm font-semibold">Залишки змінилися</p>
      </div>
      <ul className="space-y-2 text-sm">
        {issues.map((issue) => (
          <li key={issue.productId} className="flex flex-wrap items-center gap-2">
            <span className="flex-1">
              <strong>{issue.name}</strong>:{' '}
              {issue.isActive
                ? `залишилось ${issue.available} шт замість ${issue.requested}`
                : 'товар недоступний'}
            </span>
            {issue.isActive && issue.available > 0 ? (
              <button
                type="button"
                onClick={() => updateQuantity(issue.productId, issue.available)}
                className="rounded-md bg-amber-700 px-3 py-1 text-xs font-medium text-white hover:bg-amber-800"
              >
                Оновити кількість
              </button>
            ) : (
              <button
                type="button"
                onClick={() => removeItem(issue.productId)}
                className="rounded-md bg-amber-700 px-3 py-1 text-xs font-medium text-white hover:bg-amber-800"
              >
                Прибрати з кошика
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
