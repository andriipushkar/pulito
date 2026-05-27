'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

interface QualityIssue {
  productId: number;
  productSlug: string;
  productName: string;
  score: number;
  ordersCount: number;
  reasons: string[];
}

/**
 * Top 10 selling products with the worst descriptions. Focus the owner on
 * the few descriptions that, if improved, directly increase conversion.
 */
export default function ProductQualityWidget() {
  const [products, setProducts] = useState<QualityIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ products: QualityIssue[] }>('/api/v1/admin/product-quality')
      .then((res) => {
        if (!cancelled && res.success && res.data) setProducts(res.data.products);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading || products.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
      <div className="mb-4">
        <h2 className="text-base font-bold">📝 Якість описів — увага потрібно</h2>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Топ-10 товарів що продаються, але мають слабкий опис — найбільший потенціал росту
          конверсії.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-secondary)]">
            <tr>
              <th className="px-3 py-2 text-left">Товар</th>
              <th className="px-3 py-2 text-right">Score</th>
              <th className="px-3 py-2 text-right">Продажів</th>
              <th className="px-3 py-2 text-left">Що поправити</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.productId} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/products/${p.productId}`}
                    className="font-medium hover:underline"
                  >
                    {p.productName}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      p.score < 50
                        ? 'bg-red-100 text-red-700'
                        : p.score < 75
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {p.score}/100
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-semibold">{p.ordersCount}</td>
                <td className="px-3 py-2">
                  <ul className="space-y-0.5 text-xs text-[var(--color-text-secondary)]">
                    {p.reasons.slice(0, 4).map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                    {p.reasons.length > 4 && <li className="italic">…ще {p.reasons.length - 4}</li>}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
        Натисніть на товар → у формі редагування натисніть «✨ Згенерувати» → AI відразу зробить
        якісний опис.
      </p>
    </div>
  );
}
