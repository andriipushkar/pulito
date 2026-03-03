'use client';

import { useState } from 'react';
import Badge from '@/components/ui/Badge';
import PriceDisplay from './PriceDisplay';
import QuantitySelector from './QuantitySelector';
import ShareButtons from './ShareButtons';
import { Heart, Cart } from '@/components/icons';
import { useCart } from '@/hooks/useCart';
import type { ProductDetail } from '@/types/product';

interface ProductInfoProps {
  product: ProductDetail;
}

export default function ProductInfo({ product }: ProductInfoProps) {
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
      priceWholesale: product.priceWholesale ? Number(product.priceWholesale) : null,
      imagePath: mainImage,
      quantity,
      maxQuantity: product.quantity,
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)] lg:text-3xl">{product.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--color-text-secondary)]">Код: {product.code}</span>
          {product.badges.slice(0, 2).map((badge) => (
            <Badge key={badge.id} color={badge.customColor || undefined}>
              {badge.customText || badge.badgeType}
            </Badge>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-[var(--color-bg-secondary)] p-4">
        <PriceDisplay
          priceRetail={product.priceRetail}
          priceWholesale={product.priceWholesale}
          priceRetailOld={product.priceRetailOld}
          size="lg"
        />
        <div className={`mt-2 text-sm font-medium ${inStock ? 'text-[var(--color-in-stock)]' : 'text-[var(--color-out-of-stock)]'}`}>
          {inStock ? `В наявності (${product.quantity} шт.)` : 'Немає в наявності'}
        </div>
      </div>

      {inStock && (
        <div className="flex flex-wrap items-center gap-3">
          <QuantitySelector value={quantity} onChange={setQuantity} max={product.quantity} />
          <button
            data-add-to-cart
            onClick={handleAddToCart}
            className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-[var(--color-primary)] px-8 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-[var(--color-primary-dark)] hover:shadow-lg"
          >
            <Cart size={20} />
            В кошик
          </button>
          <button
            className="rounded-[var(--radius)] border border-[var(--color-border)] p-3 text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
            aria-label="Додати в обране"
          >
            <Heart size={20} />
          </button>
        </div>
      )}

      <ShareButtons url={`/product/${product.slug}`} title={product.name} />
    </div>
  );
}
