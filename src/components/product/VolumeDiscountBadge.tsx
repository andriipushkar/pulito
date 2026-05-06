'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface VolumeDiscount {
  id: number;
  minQuantity: number;
  maxQuantity: number | null;
  discountPercent: number;
  discountType: string;
}

interface VolumeDiscountBadgeProps {
  productId: number;
  categoryId?: number | null;
}

export default function VolumeDiscountBadge({ productId, categoryId }: VolumeDiscountBadgeProps) {
  const [discounts, setDiscounts] = useState<VolumeDiscount[]>([]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('productId', String(productId));
    if (categoryId) params.set('categoryId', String(categoryId));

    apiClient
      .get<VolumeDiscount[]>(`/api/v1/volume-discounts?${params}`)
      .then((res) => {
        if (res.success && res.data) {
          setDiscounts(res.data);
        }
      })
      .catch(() => {
        // Silently fail for badge display
      });
  }, [productId, categoryId]);

  if (discounts.length === 0) return null;

  // Find the best (highest) discount and the lowest threshold
  const maxDiscount = Math.max(...discounts.map((d) => d.discountPercent));
  const minThreshold = Math.min(...discounts.map((d) => d.minQuantity));

  // If there's a single tier, show specific text
  if (discounts.length === 1) {
    const d = discounts[0];
    const suffix = d.discountType === 'fixed_amount' ? ' грн' : '%';
    return (
      <span
        className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
        data-testid="volume-discount-badge"
      >
        {`Від ${d.minQuantity} шт — знижка ${d.discountPercent}${suffix}`}
      </span>
    );
  }

  // Multiple tiers: show summary
  return (
    <span
      className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
      data-testid="volume-discount-badge"
    >
      {`Гуртова знижка до ${maxDiscount}% (від ${minThreshold} шт)`}
    </span>
  );
}
