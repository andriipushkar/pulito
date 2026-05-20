'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';
import type { CartItem } from '@/providers/CartProvider';

export interface StockIssue {
  productId: number;
  name: string;
  requested: number;
  available: number;
  isActive: boolean;
}

interface ValidateResponse {
  items: { productId: number; name: string; stock: number; isActive: boolean }[];
}

const REFRESH_INTERVAL_MS = 30_000;

export function useCartStockValidation(items: CartItem[]): {
  issues: StockIssue[];
  isValidating: boolean;
} {
  const productIds = items
    .map((i) => i.productId)
    .slice()
    .sort((a, b) => a - b);

  const key = productIds.length > 0 ? `cart-validate:${productIds.join(',')}` : null;

  const { data, isValidating } = useSWR<ValidateResponse>(
    key,
    async () => {
      const res = await apiClient.post<ValidateResponse>('/api/v1/cart/validate', {
        productIds,
      });
      if (!res.success || !res.data) throw new Error('validate failed');
      return res.data;
    },
    {
      refreshInterval: REFRESH_INTERVAL_MS,
      revalidateOnFocus: true,
      dedupingInterval: 10_000,
    },
  );

  const issues: StockIssue[] = [];
  if (data?.items) {
    const byId = new Map(data.items.map((p) => [p.productId, p]));
    for (const item of items) {
      const server = byId.get(item.productId);
      if (!server) continue;
      if (!server.isActive) {
        issues.push({
          productId: item.productId,
          name: server.name,
          requested: item.quantity,
          available: 0,
          isActive: false,
        });
      } else if (server.stock < item.quantity) {
        issues.push({
          productId: item.productId,
          name: server.name,
          requested: item.quantity,
          available: server.stock,
          isActive: true,
        });
      }
    }
  }

  return { issues, isValidating };
}
