'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { apiClient } from '@/lib/api-client';
import { useCart } from '@/hooks/useCart';
import type { CartItem } from '@/providers/CartProvider';
import { Plus, Cart as CartIcon } from '@/components/icons';

interface Recommendation {
  id: number;
  name: string;
  slug: string;
  code: string;
  priceRetail: string | number;
  imagePath: string | null;
  isPromo: boolean;
  images: { pathThumbnail: string | null }[];
}

interface FrequentlyBoughtProps {
  cartItems: CartItem[];
  limit?: number;
}

export default function FrequentlyBought({ cartItems, limit = 3 }: FrequentlyBoughtProps) {
  const { addItem } = useCart();
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const productIds = cartItems.map((i) => i.productId).sort((a, b) => a - b);
  const productIdsKey = productIds.join(',');

  useEffect(() => {
    let cancelled = false;
    if (productIds.length === 0) {
      setRecs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    apiClient
      .post<Recommendation[]>('/api/v1/recommendations/cart', {
        productIds,
        limit,
      })
      .then((res) => {
        if (cancelled) return;
        if (res.success && Array.isArray(res.data)) {
          setRecs(res.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIdsKey, limit]);

  if (loading || recs.length === 0) return null;

  const handleAdd = (rec: Recommendation) => {
    addItem({
      productId: rec.id,
      name: rec.name,
      slug: rec.slug,
      code: rec.code,
      priceRetail: Number(rec.priceRetail),
      priceWholesale: null,
      imagePath: rec.images?.[0]?.pathThumbnail ?? rec.imagePath ?? null,
      quantity: 1,
      maxQuantity: 999,
    });
  };

  return (
    <section className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
        Часто купують разом
      </h3>
      <div className="space-y-2">
        {recs.map((rec) => {
          const thumb = rec.images?.[0]?.pathThumbnail ?? rec.imagePath;
          return (
            <div
              key={rec.id}
              className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] p-2"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-[var(--color-bg-secondary)]">
                {thumb ? (
                  <Image src={thumb} alt={rec.name} fill sizes="56px" className="object-contain" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
                    <CartIcon size={16} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/product/${rec.slug}`}
                  className="line-clamp-2 text-sm font-medium hover:text-[var(--color-primary)]"
                >
                  {rec.name}
                </Link>
                <p className="text-sm font-semibold tabular-nums">
                  {Number(rec.priceRetail).toFixed(0)} ₴
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleAdd(rec)}
                className="flex h-9 shrink-0 items-center gap-1 rounded-md bg-[var(--color-primary)] px-3 text-xs font-medium text-white hover:bg-[var(--color-primary)]/90"
                aria-label={`Додати ${rec.name} до кошика`}
              >
                <Plus size={14} />
                <span>Додати</span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
