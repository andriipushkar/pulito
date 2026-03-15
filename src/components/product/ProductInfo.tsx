'use client';

import { useState } from 'react';
import Badge from '@/components/ui/Badge';
import PriceDisplay from './PriceDisplay';
import QuantitySelector from './QuantitySelector';
import ShareButtons from './ShareButtons';
import { Heart, Cart } from '@/components/icons';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { resolveWholesalePrice } from '@/lib/wholesale-price';
import type { ProductDetail } from '@/types/product';

interface ProductInfoProps {
  product: ProductDetail;
}

export default function ProductInfo({ product }: ProductInfoProps) {
  const { user } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();
  const inStock = product.quantity > 0;
  const mainImage = product.images[0]?.pathMedium || product.imagePath;

  const handleAddToCart = () => {
    if (!inStock) return;
    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      code: product.code,
      priceRetail: Number(product.priceRetail),
      priceWholesale: resolveWholesalePrice(product, user?.wholesaleGroup) ?? (product.priceWholesale ? Number(product.priceWholesale) : null),
      imagePath: mainImage,
      quantity,
      maxQuantity: product.quantity,
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Title & code */}
      <div>
        <h1 className="text-2xl font-bold leading-snug tracking-tight text-[var(--color-text)] lg:text-3xl">{product.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--color-text-secondary)]">Код: {product.code}</span>
          {product.badges.slice(0, 2).map((badge) => (
            <Badge key={badge.id} color={badge.customColor || undefined}>
              {badge.customText || badge.badgeType}
            </Badge>
          ))}
        </div>
      </div>

      {/* Price block — glass style */}
      <div className="rounded-2xl border border-white/60 bg-[var(--color-bg-secondary)]/60 p-4 backdrop-blur-sm">
        <PriceDisplay
          priceRetail={product.priceRetail}
          priceWholesale={product.priceWholesale}
          priceWholesale2={product.priceWholesale2}
          priceWholesale3={product.priceWholesale3}
          priceRetailOld={product.priceRetailOld}
          size="lg"
        />
        <div className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${inStock ? 'text-[var(--color-in-stock)]' : 'text-[var(--color-out-of-stock)]'}`}>
          {inStock && (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          )}
          {inStock ? `В наявності (${product.quantity} шт.)` : 'Немає в наявності'}
        </div>
      </div>

      {/* Buy section */}
      {inStock && (
        <div className="flex items-stretch gap-2">
          <QuantitySelector value={quantity} onChange={setQuantity} max={product.quantity} />
          <button
            data-add-to-cart
            onClick={handleAddToCart}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-6 py-3 text-base font-semibold text-white shadow-[var(--shadow-brand)] transition-all hover:shadow-[var(--shadow-brand-lg)] active:scale-[0.98]"
          >
            <Cart size={20} />
            В кошик
          </button>
        </div>
      )}

      {/* Wishlist + share row */}
      <div className="flex items-center justify-between">
        <ShareButtons url={`/product/${product.slug}`} title={product.name} />
        <button
          className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
          aria-label="Додати в обране"
        >
          <Heart size={18} />
          <span className="hidden sm:inline">В обране</span>
        </button>
      </div>
    </div>
  );
}
