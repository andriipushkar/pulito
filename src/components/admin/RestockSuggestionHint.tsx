'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';

interface Suggestion {
  productId: number;
  windowDays: number;
  soldInWindow: number;
  velocityPerDay: number;
  daysOfStock: number | null;
  suggestedQuantity: number;
  rationale: string;
}

interface Props {
  productId: number;
  onApply: (qty: number) => void;
}

export default function RestockSuggestionHint({ productId, onApply }: Props) {
  const t = useTranslations('admin.restockSuggestionHint');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Suggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const res = await apiClient.get<Suggestion>(
      `/api/v1/admin/products/${productId}/restock-suggestion`,
    );
    setLoading(false);
    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.error || t('error'));
    }
  };

  if (!data && !loading && !error) {
    return (
      <button
        type="button"
        onClick={load}
        className="mt-1 text-xs text-[var(--color-primary)] hover:underline"
      >
        {t('suggestLink')}
      </button>
    );
  }

  if (loading) {
    return <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t('analyzing')}</p>;
  }

  if (error) {
    return <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>;
  }

  if (!data) return null;

  const stale = data.daysOfStock !== null && data.daysOfStock < 7;
  return (
    <div
      className={`mt-1 rounded-[var(--radius)] border p-2 text-xs ${
        stale
          ? 'border-amber-200 bg-amber-50'
          : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]'
      }`}
    >
      <p className="leading-snug text-[var(--color-text)]">{data.rationale}</p>
      {data.suggestedQuantity > 0 && (
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[var(--color-text-secondary)]">
            {t('suggestionLabel')}{' '}
            <strong>{t('suggestionQty', { count: data.suggestedQuantity })}</strong>
          </span>
          <button
            type="button"
            onClick={() => onApply(data.suggestedQuantity)}
            className="rounded bg-[var(--color-primary)] px-2 py-0.5 text-[10px] font-medium text-white hover:bg-[var(--color-primary-dark)]"
          >
            {t('apply')}
          </button>
        </div>
      )}
    </div>
  );
}
