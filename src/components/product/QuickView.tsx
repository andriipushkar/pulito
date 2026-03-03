'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { useCart } from '@/hooks/useCart';
import PriceDisplay from './PriceDisplay';
import Button from '@/components/ui/Button';
import { Close, Cart } from '@/components/icons';
import type { ProductListItem } from '@/types/product';

interface QuickViewProps {
  productId: number;
  onClose: () => void;
}

export default function QuickView({ productId, onClose }: QuickViewProps) {
  const [product, setProduct] = useState<ProductListItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();

  useEffect(() => {
    apiClient
      .get<ProductListItem>(`/api/v1/products/${productId}`)
      .then((res) => {
        if (res.success && res.data) setProduct(res.data);
      })
      .finally(() => setIsLoading(false));
  }, [productId]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleAddToCart = () => {
    if (!product || product.quantity < 1) return;
    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      code: product.code,
      priceRetail: Number(product.priceRetail),
      priceWholesale: product.priceWholesale ? Number(product.priceWholesale) : null,
      imagePath: product.images[0]?.pathMedium || product.imagePath,
      quantity,
      maxQuantity: product.quantity,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Швидкий перегляд товару">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-2xl rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-lg">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          aria-label="Закрити вікно"
        >
          <Close size={20} />
        </button>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : product ? (
          <div className="flex gap-6">
            <div className="w-1/2 shrink-0">
              <div className="aspect-square overflow-hidden rounded-[var(--radius)] bg-[var(--color-bg-secondary)]">
                {product.images[0]?.pathMedium || product.imagePath ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={product.images[0]?.pathMedium || product.imagePath || ''}
                    alt={product.name}
                    className="h-full w-full object-contain p-2"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl text-[var(--color-text-secondary)]">
                    📷
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-1 flex-col">
              <p className="mb-1 text-xs text-[var(--color-text-secondary)]">Код: {product.code}</p>
              <h2 className="mb-3 text-lg font-bold">{product.name}</h2>

              <PriceDisplay
                priceRetail={product.priceRetail}
                priceRetailOld={product.priceRetailOld}
                size="lg"
              />

              <p className={`mt-2 text-sm ${product.quantity > 0 ? 'text-[var(--color-in-stock)]' : 'text-[var(--color-out-of-stock)]'}`}>
                {product.quantity > 0 ? `В наявності (${product.quantity} шт.)` : 'Немає в наявності'}
              </p>

              {product.quantity > 0 && (
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex items-center rounded-[var(--radius)] border border-[var(--color-border)]">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3 py-1 text-lg hover:bg-[var(--color-bg-secondary)]"
                      aria-label="Зменшити кількість"
                    >
                      -
                    </button>
                    <span className="min-w-[2rem] text-center text-sm" aria-live="polite">{quantity}</span>
                    <button
                      onClick={() => setQuantity(Math.min(product.quantity, quantity + 1))}
                      className="px-3 py-1 text-lg hover:bg-[var(--color-bg-secondary)]"
                      aria-label="Збільшити кількість"
                    >
                      +
                    </button>
                  </div>
                  <Button onClick={handleAddToCart}>
                    <Cart size={16} />
                    <span className="ml-2">В кошик</span>
                  </Button>
                </div>
              )}

              <Link
                href={`/product/${product.slug}`}
                className="mt-auto pt-4 text-sm text-[var(--color-primary)] hover:underline"
                onClick={onClose}
              >
                Детальніше про товар →
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-center text-[var(--color-text-secondary)]">Товар не знайдено</p>
        )}
      </div>
    </div>
  );
}
