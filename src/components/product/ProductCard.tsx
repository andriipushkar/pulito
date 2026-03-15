'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import PriceDisplay from './PriceDisplay';
import { Heart, HeartFilled, Cart, Search, Compare } from '@/components/icons';

const QuickView = dynamic(() => import('./QuickView'), { ssr: false });
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { useComparison } from '@/hooks/useComparison';
import { apiClient } from '@/lib/api-client';
import { resolveWholesalePrice } from '@/lib/wholesale-price';
import type { ProductListItem } from '@/types/product';

const WISHLIST_STORAGE_KEY = 'clean-shop-wishlist';

function getLocalWishlist(): number[] {
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setLocalWishlist(ids: number[]) {
  try {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(ids));
  } catch {}
}

// Витягує ключові характеристики (об'єм, вагу) з назви або опису
function extractAttributes(name: string, description?: string | null): string[] {
  const text = `${name} ${description || ''}`;
  const attrs: string[] = [];
  // Об'єм: 500мл, 1л, 1.5 л, 2L тощо
  const volumeMatch = text.match(/(\d+[.,]?\d*)\s*(мл|ml|л|l|літр[іа]?)\b/i);
  if (volumeMatch) {
    const val = volumeMatch[1].replace(',', '.');
    const unit = volumeMatch[2].toLowerCase();
    const normalized = unit === 'мл' || unit === 'ml' ? `${val} мл` : `${val} л`;
    attrs.push(normalized);
  }
  // Вага: 500г, 1кг, 2.5 кг тощо
  const weightMatch = text.match(/(\d+[.,]?\d*)\s*(г|g|кг|kg|грам)\b/i);
  if (weightMatch) {
    const val = weightMatch[1].replace(',', '.');
    const unit = weightMatch[2].toLowerCase();
    const normalized = unit === 'г' || unit === 'g' || unit === 'грам' ? `${val} г` : `${val} кг`;
    attrs.push(normalized);
  }
  // Кількість штук: 10 шт, 20шт тощо
  const pcsMatch = text.match(/(\d+)\s*(шт|tabs?|caps?|штук)\b/i);
  if (pcsMatch) {
    attrs.push(`${pcsMatch[1]} шт`);
  }
  return attrs;
}

interface ProductCardProps {
  product: ProductListItem;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const { has: hasCompare, toggle: toggleCompare } = useComparison();
  const isCompared = hasCompare(product.id);
  const [showQuickView, setShowQuickView] = useState(false);
  const [isWished, setIsWished] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const inStock = product.quantity > 0;
  const mainImage = product.images[0]?.pathMedium || product.imagePath;
  const hoverImage = product.images[1]?.pathMedium;
  const blurImage = product.images[0]?.pathBlur;
  const attributes = extractAttributes(product.name, product.content?.shortDescription);

  useEffect(() => {
    if (user) {
      apiClient
        .get<{ wishlisted: boolean }>(`/api/v1/me/wishlists/default/items/${product.id}`)
        .then((res) => {
          if (res.success && res.data) setIsWished(res.data.wishlisted);
        })
        .catch(() => {});
    } else {
      setIsWished(getLocalWishlist().includes(product.id));
    }
  }, [user, product.id]);

  const handleToggleWishlist = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const newState = !isWished;
      setIsWished(newState);

      if (user) {
        try {
          if (newState) {
            await apiClient.post(`/api/v1/me/wishlists/default/items/${product.id}`);
          } else {
            await apiClient.delete(`/api/v1/me/wishlists/default/items/${product.id}`);
          }
        } catch {
          setIsWished(!newState);
        }
      } else {
        const ids = getLocalWishlist();
        if (newState) {
          if (!ids.includes(product.id)) {
            setLocalWishlist([...ids, product.id]);
          }
        } else {
          setLocalWishlist(ids.filter((id) => id !== product.id));
        }
      }
    },
    [isWished, user, product.id]
  );

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!inStock) return;
    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      code: product.code,
      priceRetail: Number(product.priceRetail),
      priceWholesale: resolveWholesalePrice(product, user?.wholesaleGroup) ?? (product.priceWholesale ? Number(product.priceWholesale) : null),
      imagePath: mainImage,
      quantity: 1,
      maxQuantity: product.quantity,
    });
  };

  return (
    <div
      className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-transparent bg-[var(--color-bg)] shadow-[var(--shadow)] transition-all duration-300 hover:shadow-[var(--shadow-xl)] hover:border-[var(--color-primary-light)]/30 hover:-translate-y-1 sm:rounded-2xl"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link href={`/product/${product.slug}`} className="relative aspect-square overflow-hidden bg-[var(--color-bg-secondary)]">
        {mainImage ? (
          <>
            {blurImage && !imageLoaded && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={blurImage}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full scale-110 object-contain blur-lg"
              />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mainImage}
              alt={product.name}
              className={`h-full w-full object-contain transition-all duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'} ${hovered && hoverImage ? 'scale-105 opacity-0' : 'group-hover:scale-105'}`}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
            />
            {hoverImage && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={hoverImage}
                alt={product.name}
                className={`absolute inset-0 h-full w-full object-contain transition-all duration-500 ${hovered ? 'scale-105 opacity-100' : 'opacity-0'}`}
                loading="lazy"
              />
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <svg className="h-10 w-10 text-gray-300 sm:h-16 sm:w-16" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="22" y="4" width="20" height="6" rx="2" fill="currentColor" opacity="0.5" />
              <rect x="26" y="1" width="4" height="5" rx="1" fill="currentColor" opacity="0.4" />
              <rect x="34" y="1" width="4" height="5" rx="1" fill="currentColor" opacity="0.4" />
              <path d="M20 10h24v6a4 4 0 01-4 4H24a4 4 0 01-4-4v-6z" fill="currentColor" opacity="0.5" />
              <rect x="24" y="20" width="16" height="36" rx="4" fill="currentColor" opacity="0.6" />
              <rect x="28" y="24" width="8" height="12" rx="2" fill="currentColor" opacity="0.3" />
              <circle cx="14" cy="6" r="1.5" fill="currentColor" opacity="0.3" />
              <circle cx="11" cy="10" r="1" fill="currentColor" opacity="0.2" />
              <circle cx="50" cy="8" r="1.5" fill="currentColor" opacity="0.3" />
              <circle cx="53" cy="12" r="1" fill="currentColor" opacity="0.2" />
            </svg>
            <span className="mt-2 text-[10px] font-semibold tracking-widest text-gray-300 select-none">Порошок</span>
          </div>
        )}

        {product.badges.length > 0 && (
          <div className="absolute left-1 top-1 flex flex-col gap-0.5 sm:left-2 sm:top-2 sm:gap-1">
            {product.badges.slice(0, 2).map((badge) => (
              <Badge key={badge.id} color={badge.customColor || undefined}>
                {badge.customText || badge.badgeType}
              </Badge>
            ))}
          </div>
        )}

        <div className="absolute right-1 top-1 flex flex-col gap-1 translate-x-10 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 max-sm:translate-x-0 max-sm:opacity-100 sm:right-2 sm:top-2">
          <button
            className={`rounded-full bg-white/90 p-1 shadow-[var(--shadow)] backdrop-blur-sm transition-colors sm:p-1.5 ${isWished ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]'}`}
            aria-label={isWished ? 'Видалити з обраного' : 'Додати в обране'}
            onClick={handleToggleWishlist}
          >
            {isWished ? <HeartFilled size={16} /> : <Heart size={16} />}
          </button>
          <button
            className={`rounded-full bg-white/90 p-1 shadow-[var(--shadow)] backdrop-blur-sm transition-colors sm:p-1.5 ${
              isCompared ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]'
            }`}
            aria-label={isCompared ? 'Видалити з порівняння' : 'Додати до порівняння'}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCompare(product.id); }}
          >
            <Compare size={16} />
          </button>
          <button
            className="hidden rounded-full bg-white/90 p-1.5 text-[var(--color-text-secondary)] shadow-[var(--shadow)] backdrop-blur-sm hover:text-[var(--color-primary)] sm:block"
            aria-label="Швидкий перегляд"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowQuickView(true); }}
          >
            <Search size={16} />
          </button>
        </div>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col p-2 sm:p-3">
        {product.category && (
          <span className="mb-0.5 truncate text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)] sm:text-[11px]">
            {product.category.name}
          </span>
        )}

        <Link href={`/product/${product.slug}`} className="mb-1 line-clamp-2 text-xs font-medium leading-snug text-[var(--color-text)] hover:text-[var(--color-primary)] sm:text-sm">
          {product.name}
        </Link>

        {attributes.length > 0 && (
          <div className="mb-1 flex flex-wrap gap-1">
            {attributes.map((attr) => (
              <span key={attr} className="inline-flex items-center rounded-md bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">
                {attr}
              </span>
            ))}
          </div>
        )}

        {product.content?.shortDescription && !attributes.length && (
          <p className="mb-1 line-clamp-1 text-xs text-[var(--color-text-secondary)]">
            {product.content.shortDescription}
          </p>
        )}

        <div className="mt-auto">
          <PriceDisplay
            priceRetail={product.priceRetail}
            priceRetailOld={product.priceRetailOld}
            priceWholesale={product.priceWholesale}
            priceWholesale2={product.priceWholesale2}
            priceWholesale3={product.priceWholesale3}
            size="sm"
          />

          <div className="mt-2.5 flex items-center justify-between gap-1 sm:mt-3 sm:gap-2">
            <span className={`shrink-0 text-[10px] font-medium sm:text-xs ${inStock ? 'text-[var(--color-in-stock)]' : 'text-[var(--color-out-of-stock)]'}`}>
              {inStock ? 'В наявності' : 'Немає'}
            </span>
            <button
              onClick={handleAddToCart}
              disabled={!inStock}
              className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-primary)] px-2.5 py-1.5 text-xs font-medium text-white shadow-[var(--shadow-brand)] transition-all hover:bg-[var(--color-primary-dark)] hover:shadow-[var(--shadow-brand-lg)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none sm:gap-1.5 sm:px-3.5"
              aria-label="В кошик"
            >
              <Cart size={14} />
              <span className="hidden sm:inline">В кошик</span>
            </button>
          </div>
        </div>
      </div>

      {showQuickView && (
        <QuickView productId={product.id} onClose={() => setShowQuickView(false)} />
      )}
    </div>
  );
}
