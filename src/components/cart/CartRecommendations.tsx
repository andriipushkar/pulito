'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { Cart } from '@/components/icons';
import { useCart } from '@/hooks/useCart';
import Spinner from '@/components/ui/Spinner';

interface RecommendedProduct {
  id: number;
  name: string;
  slug: string;
  code: string;
  priceRetail: number | string;
  imagePath: string | null;
  images: { pathThumbnail: string | null }[];
}

interface CartRecommendationsProps {
  cartProductIds: number[];
}

export default function CartRecommendations({ cartProductIds }: CartRecommendationsProps) {
  const [products, setProducts] = useState<RecommendedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(cartProductIds.length > 0);
  const { addItem } = useCart();

  useEffect(() => {
    if (cartProductIds.length === 0) {
      return;
    }

    // Fetch recommendations for the first 3 cart items and merge
    const ids = cartProductIds.slice(0, 3);
    Promise.all(
      ids.map((id) =>
        apiClient.get<RecommendedProduct[]>(`/api/v1/products/${id}/recommendations`)
      )
    )
      .then((results) => {
        const seen = new Set(cartProductIds);
        const merged: RecommendedProduct[] = [];

        for (const res of results) {
          if (res.success && res.data) {
            for (const p of res.data) {
              if (!seen.has(p.id)) {
                seen.add(p.id);
                merged.push(p);
              }
            }
          }
        }
        setProducts(merged.slice(0, 8));
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [cartProductIds]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="sm" />
      </div>
    );
  }

  if (products.length === 0) return null;

  const handleAdd = (p: RecommendedProduct) => {
    addItem({
      productId: p.id,
      name: p.name,
      slug: p.slug,
      code: p.code,
      priceRetail: Number(p.priceRetail),
      priceWholesale: null,
      imagePath: p.images[0]?.pathThumbnail || p.imagePath,
      quantity: 1,
      maxQuantity: 999,
    });
  };

  return (
    <div className="mt-10">
      <h2 className="mb-4 text-lg font-bold">Доповніть замовлення</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {products.map((p) => {
          const image = p.images[0]?.pathThumbnail || p.imagePath;
          return (
            <div
              key={p.id}
              className="flex w-[160px] shrink-0 flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]"
            >
              <Link href={`/product/${p.slug}`} className="block aspect-square bg-[var(--color-bg-secondary)]">
                {image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={image} alt={p.name} className="h-full w-full object-contain p-2" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)] opacity-30">
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </Link>
              <div className="flex flex-1 flex-col p-2">
                <Link href={`/product/${p.slug}`} className="mb-1 line-clamp-2 text-xs font-medium leading-tight hover:text-[var(--color-primary)]">
                  {p.name}
                </Link>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-sm font-bold">{Number(p.priceRetail).toFixed(2)} ₴</span>
                  <button
                    onClick={() => handleAdd(p)}
                    className="rounded-[var(--radius)] bg-[var(--color-primary)] p-1.5 text-white transition-colors hover:bg-[var(--color-primary-dark)]"
                    aria-label="В кошик"
                  >
                    <Cart size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
