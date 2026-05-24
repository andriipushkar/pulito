'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import PriceDisplay from './PriceDisplay';
import QuantitySelector from './QuantitySelector';
import ShareButtons from './ShareButtons';
import { Heart, Cart } from '@/components/icons';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { resolveWholesalePrice } from '@/lib/wholesale-price';
import SubscribeButton from './SubscribeButton';
import BackInStockButton from './BackInStockButton';
import type { ProductDetail, ProductVariantSummary } from '@/types/product';

interface ProductInfoProps {
  product: ProductDetail;
}

/**
 * Group variants by option dimensions (e.g. size, color). Returns a stable
 * list of dimensions and unique values per dimension so the UI can render one
 * pill row per dimension. When variants have a single option key (only `size`)
 * the picker collapses to one row; with two keys we get the familiar
 * "size × color" matrix.
 */
function asOptionsRecord(opts: unknown): Record<string, string> | null {
  if (!opts || typeof opts !== 'object') return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(opts as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
    else if (typeof v === 'number') out[k] = String(v);
  }
  return Object.keys(out).length > 0 ? out : null;
}

function buildOptionDimensions(variants: ProductVariantSummary[]) {
  const dims = new Map<string, Set<string>>();
  for (const v of variants) {
    const opts = asOptionsRecord(v.options);
    if (!opts) continue;
    for (const [k, val] of Object.entries(opts)) {
      if (!dims.has(k)) dims.set(k, new Set());
      dims.get(k)!.add(val);
    }
  }
  return Array.from(dims.entries()).map(([key, values]) => ({
    key,
    values: Array.from(values),
  }));
}

const DIMENSION_LABEL: Record<string, string> = {
  size: 'Розмір',
  color: 'Колір',
  flavour: 'Смак',
};

export default function ProductInfo({ product }: ProductInfoProps) {
  const { user } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();

  const variants = product.variants ?? [];
  const hasVariants = variants.length > 0;

  // Track current selection per dimension. Pre-select the first variant's
  // options so the buy button is enabled out of the box (operators expect
  // "size: M" by default if M is in stock and listed first).
  const dimensions = useMemo(() => buildOptionDimensions(variants), [variants]);
  const [selection, setSelection] = useState<Record<string, string>>(() => {
    const first = variants[0];
    const opts = first ? asOptionsRecord(first.options) : null;
    return opts ? { ...opts } : {};
  });

  const activeVariant: ProductVariantSummary | null = useMemo(() => {
    if (!hasVariants) return null;
    return (
      variants.find((v) => {
        const opts = asOptionsRecord(v.options);
        if (!opts) return false;
        return Object.entries(selection).every(([k, val]) => opts[k] === val);
      }) ?? null
    );
  }, [hasVariants, variants, selection]);

  // Resolve effective price + stock — variant overrides product when one is selected
  // and explicitly has those fields, otherwise fall back to the parent product.
  const effectivePriceRetail =
    activeVariant?.priceRetail != null
      ? Number(activeVariant.priceRetail)
      : Number(product.priceRetail);
  const effectiveQuantity = activeVariant ? activeVariant.quantity : product.quantity;
  const inStock = effectiveQuantity > 0;
  const mainImage = activeVariant?.imagePath || product.images[0]?.pathMedium || product.imagePath;
  const settings = useSettings();
  const hideQty =
    (product as { hideQuantity?: boolean }).hideQuantity || settings.hide_all_quantity === '1';

  const handleAddToCart = () => {
    if (!inStock) return;
    addItem({
      productId: product.id,
      // When a variant is picked, attach its SKU to the cart row name so the
      // operator + invoice see "Product · Size M · Red" not just "Product".
      name: activeVariant
        ? `${product.name} · ${Object.entries(selection)
            .map(([k, v]) => `${DIMENSION_LABEL[k] ?? k}: ${v}`)
            .join(' · ')}`
        : product.name,
      slug: product.slug,
      code: activeVariant?.sku ?? product.code,
      priceRetail: effectivePriceRetail,
      priceWholesale:
        activeVariant?.priceWholesale != null
          ? Number(activeVariant.priceWholesale)
          : (resolveWholesalePrice(product, user?.wholesaleGroup) ??
            (product.priceWholesale ? Number(product.priceWholesale) : null)),
      imagePath: mainImage,
      quantity,
      maxQuantity: effectiveQuantity,
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Title & code */}
      <div>
        <h1 className="text-2xl font-bold leading-snug tracking-tight text-[var(--color-text)] lg:text-3xl">
          {product.name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--color-text-secondary)]">
            Код: {activeVariant?.sku ?? product.code}
          </span>
          {product.barcode && (
            <span
              className="font-mono text-xs text-[var(--color-text-tertiary)]"
              title="Штрихкод (EAN/UPC)"
            >
              EAN: {product.barcode}
            </span>
          )}
          {product.brand && (
            <Link
              href={`/catalog?brand=${product.brand.slug}`}
              className="text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              {product.brand.name}
            </Link>
          )}
          {product.badges.slice(0, 2).map((badge) => (
            <Badge key={badge.id} color={badge.customColor || undefined}>
              {badge.customText || badge.badgeType}
            </Badge>
          ))}
        </div>
      </div>

      {/* Variant picker — one row per option dimension (size / color / flavour). */}
      {hasVariants && dimensions.length > 0 && (
        <div className="space-y-3">
          {dimensions.map((dim) => (
            <div key={dim.key}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                {DIMENSION_LABEL[dim.key] ?? dim.key}: {selection[dim.key]}
              </p>
              <div className="flex flex-wrap gap-2">
                {dim.values.map((val) => {
                  const matchOptions = { ...selection, [dim.key]: val };
                  const matched = variants.find((v) => {
                    const opts = asOptionsRecord(v.options);
                    if (!opts) return false;
                    return Object.entries(matchOptions).every(([k, vv]) => opts[k] === vv);
                  });
                  const variantInStock = matched ? matched.quantity > 0 : false;
                  const isSelected = selection[dim.key] === val;
                  return (
                    <button
                      type="button"
                      key={val}
                      onClick={() => setSelection((curr) => ({ ...curr, [dim.key]: val }))}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        isSelected
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                          : variantInStock
                            ? 'border-[var(--color-border)] hover:border-[var(--color-primary)]'
                            : 'border-[var(--color-border)] text-[var(--color-text-tertiary)] line-through'
                      }`}
                      title={!variantInStock ? 'Немає в наявності' : undefined}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Price block — glass style */}
      <div className="rounded-2xl border border-white/60 bg-[var(--color-bg-secondary)]/60 p-4 backdrop-blur-sm">
        <PriceDisplay
          priceRetail={effectivePriceRetail}
          priceWholesale={
            activeVariant?.priceWholesale != null
              ? Number(activeVariant.priceWholesale)
              : product.priceWholesale
          }
          priceWholesale2={product.priceWholesale2}
          priceWholesale3={product.priceWholesale3}
          priceRetailOld={product.priceRetailOld}
          size="lg"
        />
        <div
          className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${inStock ? 'text-[var(--color-in-stock)]' : 'text-[var(--color-out-of-stock)]'}`}
        >
          {inStock && (
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          )}
          {inStock
            ? hideQty
              ? 'В наявності'
              : `В наявності (${effectiveQuantity} шт.)`
            : 'Немає в наявності'}
        </div>
        {(() => {
          // Show physical params chip when the selected variant (or parent)
          // declares weight. Helps customer estimate shipping cost upfront.
          const grams =
            (activeVariant?.weightGrams as number | null | undefined) ??
            (product as { weightGrams?: number | null }).weightGrams ??
            null;
          if (!grams) return null;
          const label = grams >= 1000 ? `${(grams / 1000).toFixed(2)} кг` : `${grams} г`;
          return (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
              ⚖ {label}
            </div>
          );
        })()}
      </div>

      {/* Buy section */}
      {inStock ? (
        <div className="flex items-stretch gap-2">
          <QuantitySelector value={quantity} onChange={setQuantity} max={effectiveQuantity} />
          <button
            data-add-to-cart
            onClick={handleAddToCart}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-6 py-3 text-base font-semibold text-white shadow-[var(--shadow-brand)] transition-all hover:shadow-[var(--shadow-brand-lg)] active:scale-[0.98]"
          >
            <Cart size={20} />В кошик
          </button>
        </div>
      ) : (
        <BackInStockButton productId={product.id} />
      )}

      {/* Subscribe & Save */}
      {inStock && (
        <SubscribeButton
          productId={product.id}
          productName={product.name}
          price={effectivePriceRetail}
        />
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
