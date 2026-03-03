'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { Cart } from '@/components/icons';
import { useCart } from '@/hooks/useCart';

interface RecommendedProduct {
  id: number;
  name: string;
  slug: string;
  code: string;
  priceRetail: number | string;
  imagePath: string | null;
  images: { pathThumbnail: string | null }[];
}

interface BoughtTogetherSectionProps {
  productId: number;
}

export default function BoughtTogetherSection({ productId }: BoughtTogetherSectionProps) {
  const [products, setProducts] = useState<RecommendedProduct[]>([]);
  const { addItem } = useCart();

  useEffect(() => {
    apiClient
      .get<RecommendedProduct[]>(`/api/v1/products/${productId}/recommendations`)
      .then((res) => {
        if (res.success && res.data && res.data.length > 0) {
          setProducts(res.data.slice(0, 6));
        }
      })
      .catch(() => {});
  }, [productId]);

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
      <h2 className="mb-4 text-lg font-bold">З цим товаром купують</h2>
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
