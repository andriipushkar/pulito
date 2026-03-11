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
      <h2 className="relative mb-4 text-lg font-bold">
        З цим товаром купують
        <span className="absolute -bottom-1 left-0 h-0.5 w-10 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)]" />
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide lg:grid lg:grid-cols-6 lg:overflow-visible">
        {products.map((p) => {
          const image = p.images[0]?.pathThumbnail || p.imagePath;
          return (
            <div
              key={p.id}
              className="flex w-[150px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow)] transition-all hover:shadow-[var(--shadow-md)] hover:-translate-y-1 lg:w-auto"
            >
              <Link href={`/product/${p.slug}`} className="block aspect-[4/3] bg-[var(--color-bg-secondary)]">
                {image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={image} alt={p.name} className="h-full w-full object-contain p-1.5" loading="lazy" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-gray-50 to-gray-100">
                    <svg className="h-10 w-10 text-gray-300" viewBox="0 0 64 64" fill="none">
                      <rect x="18" y="8" width="28" height="4" rx="2" fill="currentColor" opacity="0.4" />
                      <rect x="16" y="14" width="32" height="42" rx="6" fill="currentColor" opacity="0.15" />
                      <rect x="16" y="14" width="32" height="42" rx="6" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
                      <circle cx="32" cy="32" r="8" fill="currentColor" opacity="0.12" />
                      <text x="32" y="36" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" opacity="0.25">P</text>
                    </svg>
                    <span className="text-[9px] font-medium text-gray-300">Порошок</span>
                  </div>
                )}
              </Link>
              <div className="flex flex-1 flex-col p-2">
                <Link href={`/product/${p.slug}`} className="mb-1 line-clamp-2 text-xs font-medium leading-tight hover:text-[var(--color-primary)]">
                  {p.name}
                </Link>
                <div className="mt-auto flex items-center justify-between gap-1">
                  <span className="text-sm font-bold">{Number(p.priceRetail).toFixed(0)} ₴</span>
                  <button
                    onClick={() => handleAdd(p)}
                    className="rounded-lg bg-[var(--color-primary)] p-1.5 text-white shadow-[var(--shadow-brand)] transition-all hover:bg-[var(--color-primary-dark)] active:scale-95"
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
