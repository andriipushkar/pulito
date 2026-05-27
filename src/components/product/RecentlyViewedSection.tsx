'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import ProductCarousel from './ProductCarousel';
import type { ProductListItem } from '@/types/product';

export default function RecentlyViewedSection() {
  const t = useTranslations('home');
  const { ids } = useRecentlyViewed();
  const [products, setProducts] = useState<ProductListItem[]>([]);

  // Stringify ids so the effect re-runs only when the actual list changes,
  // not on every parent render where useRecentlyViewed returns a new ref.
  const idsKey = ids.join(',');

  useEffect(() => {
    if (!idsKey) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/v1/products?limit=15&ids=${idsKey}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.data) setProducts(data.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  if (products.length === 0) return null;

  return <ProductCarousel title={t('recentlyViewed')} products={products} />;
}
