'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { DeliveryMethod } from '@/types/order';

interface DeliveryCostEstimateProps {
  deliveryMethod: DeliveryMethod | undefined;
  city: string;
  cartTotal: number;
  cartWeight?: number;
}

interface CostEstimate {
  cost: number | null;
  estimatedDays: string | null;
  freeFrom: number | null;
}

export default function DeliveryCostEstimate({ deliveryMethod, city, cartTotal, cartWeight }: DeliveryCostEstimateProps) {
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!deliveryMethod || deliveryMethod === 'pickup') {
      return;
    }

    const timer = setTimeout(() => {
      setIsLoading(true);
      const params = new URLSearchParams({
        method: deliveryMethod,
        total: String(cartTotal),
      });
      if (city) params.set('city', city);
      if (cartWeight) params.set('weight', String(cartWeight));

      apiClient
        .get<CostEstimate>(`/api/v1/delivery/estimate?${params}`)
        .then((res) => {
          if (res.success && res.data) setEstimate(res.data);
          else setEstimate(null);
        })
        .finally(() => setIsLoading(false));
    }, 500);

    return () => {
      clearTimeout(timer);
      setEstimate(null);
    };
  }, [deliveryMethod, city, cartTotal, cartWeight]);

  if (!deliveryMethod || deliveryMethod === 'pickup' || isLoading) return null;
  if (!estimate) return null;

  return (
    <div className="mt-3 rounded-[var(--radius)] bg-[var(--color-bg-secondary)] p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-[var(--color-text-secondary)]">Орієнтовна вартість доставки:</span>
        {estimate.cost !== null ? (
          estimate.cost === 0 ? (
            <span className="font-semibold text-green-600">Безкоштовно</span>
          ) : (
            <span className="font-semibold">{estimate.cost.toFixed(0)} ₴</span>
          )
        ) : (
          <span className="text-[var(--color-text-secondary)]">Розраховується</span>
        )}
      </div>
      {estimate.estimatedDays && (
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Термін доставки: {estimate.estimatedDays}</p>
      )}
      {estimate.freeFrom && estimate.cost !== null && estimate.cost > 0 && (
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Безкоштовна доставка від {estimate.freeFrom.toFixed(0)} ₴
          {cartTotal < estimate.freeFrom && (
            <span> (ще {(estimate.freeFrom - cartTotal).toFixed(0)} ₴)</span>
          )}
        </p>
      )}
    </div>
  );
}
