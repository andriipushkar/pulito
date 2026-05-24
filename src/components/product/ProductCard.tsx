'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import Badge from '@/components/ui/Badge';
import PriceDisplay from './PriceDisplay';
import { Heart, HeartFilled, Cart, Search, Compare } from '@/components/icons';

const QuickView = dynamic(() => import('./QuickView'), { ssr: false });
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { useComparison } from '@/hooks/useComparison';
import { apiClient } from '@/lib/api-client';
import { gtagEvent } from '@/lib/gtag';
import { useWishlistBulk } from '@/providers/WishlistBulkProvider';
import { useSettings } from '@/hooks/useSettings';
import type { ProductListItem } from '@/types/product';

const WISHLIST_STORAGE_KEY = 'pulito-wishlist';

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
  const wishlistBulk = useWishlistBulk();
  const settings = useSettings();
  const [showQuickView, setShowQuickView] = useState(false);
  const [isWished, setIsWished] = useState(false);
  const [isTogglingWish, setIsTogglingWish] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const inStock = product.quantity > 0;
  const mainImage = product.images[0]?.pathMedium || product.imagePath;
  // Якщо ховаємо кількість — не показуємо "Закінчується" badge, бо він
  // непрямо розкриває залишок ≤3.
  const hideQty = product.hideQuantity || settings.hide_all_quantity === '1';
  const hoverImage = product.images[1]?.pathMedium;
  const blurImage = product.images[0]?.pathBlur;
  const attributes = extractAttributes(product.name, product.content?.shortDescription);

  const oldPrice = product.priceRetailOld ? Number(product.priceRetailOld) : null;
  const currentPrice = Number(product.priceRetail);
  const discountPercent =
    oldPrice && oldPrice > currentPrice
      ? Math.round(((oldPrice - currentPrice) / oldPrice) * 100)
      : 0;

  const isNew = (() => {
    const created = new Date(product.createdAt as string | Date).getTime();
    return Number.isFinite(created) && Date.now() - created < 30 * 24 * 60 * 60 * 1000;
  })();

  const avgRating = product.avgRating ?? null;
  const reviewCount = product.reviewCount ?? 0;

  useEffect(() => {
    if (user) {
      if (wishlistBulk && wishlistBulk.loaded) {
        setIsWished(wishlistBulk.isWished(product.id));
        return;
      }
      if (wishlistBulk) {
        return;
      }
      apiClient
        .get<{ wishlisted: boolean }>(`/api/v1/me/wishlists/default/items/${product.id}`)
        .then((res) => {
          if (res.success && res.data) setIsWished(res.data.wishlisted);
        })
        .catch(() => {});
    } else {
      setIsWished(getLocalWishlist().includes(product.id));
    }
  }, [user, product.id, wishlistBulk]);

  const handleToggleWishlist = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isTogglingWish) return;
      const newState = !isWished;
      setIsWished(newState);

      if (user) {
        setIsTogglingWish(true);
        wishlistBulk?.setWished(product.id, newState);
        try {
          const res = newState
            ? await apiClient.post(`/api/v1/me/wishlists/default/items/${product.id}`)
            : await apiClient.delete(`/api/v1/me/wishlists/default/items/${product.id}`);
          if (!res.success) {
            setIsWished(!newState);
            wishlistBulk?.setWished(product.id, !newState);
            toast.error(res.error || 'Не вдалося оновити обране');
          } else {
            toast.success(newState ? 'Додано в обране' : 'Видалено з обраного');
          }
        } catch {
          setIsWished(!newState);
          wishlistBulk?.setWished(product.id, !newState);
          toast.error('Не вдалося оновити обране');
        } finally {
          setIsTogglingWish(false);
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
    [isWished, isTogglingWish, user, product.id, wishlistBulk],
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
      // Передаємо всі три tier — cart сам обере правильний за wholesaleGroup
      // користувача. Раніше cart обходився одним полем + fallback, але
      // тепер уникаємо плутанини коли в корзину додає group-2 чи group-3
      // юзер з різних точок UI.
      priceWholesale: product.priceWholesale != null ? Number(product.priceWholesale) : null,
      priceWholesale2: product.priceWholesale2 != null ? Number(product.priceWholesale2) : null,
      priceWholesale3: product.priceWholesale3 != null ? Number(product.priceWholesale3) : null,
      imagePath: mainImage,
      quantity: 1,
      maxQuantity: product.quantity,
    });
    gtagEvent.addToCart({
      item_id: product.code || String(product.id),
      item_name: product.name,
      price: Number(product.priceRetail),
      quantity: 1,
      item_category: product.category?.name,
      item_brand: product.brand?.name,
    });
  };

  return (
    <div
      className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-transparent bg-[var(--color-bg)] shadow-[var(--shadow)] transition-all duration-300 hover:shadow-[var(--shadow-xl)] hover:border-[var(--color-primary-light)]/30 hover:-translate-y-1 sm:rounded-2xl"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        href={`/product/${product.slug}`}
        className="relative aspect-square overflow-hidden bg-[var(--color-bg-secondary)]"
      >
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
            <Image
              src={mainImage}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, 25vw"
              className={`object-contain transition-all duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'} ${hovered && hoverImage ? 'scale-105 opacity-0' : 'group-hover:scale-105'}`}
              onLoad={() => setImageLoaded(true)}
            />
            {hoverImage && (
              <Image
                src={hoverImage}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className={`object-contain transition-all duration-500 ${hovered ? 'scale-105 opacity-100' : 'opacity-0'}`}
              />
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <svg
              className="h-10 w-10 text-gray-300 sm:h-16 sm:w-16"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="22" y="4" width="20" height="6" rx="2" fill="currentColor" opacity="0.5" />
              <rect x="26" y="1" width="4" height="5" rx="1" fill="currentColor" opacity="0.4" />
              <rect x="34" y="1" width="4" height="5" rx="1" fill="currentColor" opacity="0.4" />
              <path
                d="M20 10h24v6a4 4 0 01-4 4H24a4 4 0 01-4-4v-6z"
                fill="currentColor"
                opacity="0.5"
              />
              <rect x="24" y="20" width="16" height="36" rx="4" fill="currentColor" opacity="0.6" />
              <rect x="28" y="24" width="8" height="12" rx="2" fill="currentColor" opacity="0.3" />
              <circle cx="14" cy="6" r="1.5" fill="currentColor" opacity="0.3" />
              <circle cx="11" cy="10" r="1" fill="currentColor" opacity="0.2" />
              <circle cx="50" cy="8" r="1.5" fill="currentColor" opacity="0.3" />
              <circle cx="53" cy="12" r="1" fill="currentColor" opacity="0.2" />
            </svg>
            <span className="mt-2 text-[10px] font-semibold tracking-widest text-gray-300 select-none">
              Pulito Trade
            </span>
          </div>
        )}

        {(product.badges.length > 0 || isNew || (inStock && product.quantity <= 3 && !hideQty)) && (
          <div className="absolute left-1 top-1 flex flex-col gap-0.5 sm:left-2 sm:top-2 sm:gap-1">
            {isNew && !product.badges.some((b) => /new|новин/i.test(b.badgeType)) && (
              <Badge color="#1976D2">Новинка</Badge>
            )}
            {inStock && product.quantity <= 3 && !hideQty && (
              <Badge color="#F4511E">Закінчується</Badge>
            )}
            {product.badges.slice(0, 2).map((badge) => (
              <Badge key={badge.id} color={badge.customColor || undefined}>
                {badge.customText || badge.badgeType}
              </Badge>
            ))}
          </div>
        )}

        {discountPercent > 0 && (
          <div className="pointer-events-none absolute bottom-1 left-1 z-[1] sm:bottom-2 sm:left-2">
            <span className="inline-flex items-center rounded-full bg-[var(--color-discount)] px-2.5 py-1 text-[11px] font-extrabold leading-none text-white shadow-md sm:text-xs">
              −{discountPercent}%
            </span>
          </div>
        )}

        <div className="absolute right-1 top-1 flex flex-col gap-1 translate-x-10 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 max-sm:translate-x-0 max-sm:opacity-100 sm:right-2 sm:top-2">
          <button
            className={`rounded-full bg-white/90 p-1 shadow-[var(--shadow)] backdrop-blur-sm transition-colors disabled:opacity-50 sm:p-1.5 ${isWished ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]'}`}
            aria-label={isWished ? 'Видалити з обраного' : 'Додати в обране'}
            aria-pressed={isWished}
            disabled={isTogglingWish}
            onClick={handleToggleWishlist}
          >
            {isWished ? <HeartFilled size={16} /> : <Heart size={16} />}
          </button>
          <button
            className={`rounded-full bg-white/90 p-1 shadow-[var(--shadow)] backdrop-blur-sm transition-colors sm:p-1.5 ${
              isCompared
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]'
            }`}
            aria-label={isCompared ? 'Видалити з порівняння' : 'Додати до порівняння'}
            aria-pressed={isCompared}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                toggleCompare(product.id);
                toast.success(isCompared ? 'Видалено з порівняння' : 'Додано до порівняння');
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Не вдалося оновити список';
                toast.error(msg);
              }
            }}
          >
            <Compare size={16} />
          </button>
          <button
            className="hidden rounded-full bg-white/90 p-1.5 text-[var(--color-text-secondary)] shadow-[var(--shadow)] backdrop-blur-sm hover:text-[var(--color-primary)] sm:block"
            aria-label="Швидкий перегляд"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowQuickView(true);
            }}
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

        <Link
          href={`/product/${product.slug}`}
          className="mb-1 line-clamp-2 min-h-[2lh] text-xs font-medium leading-snug text-[var(--color-text)] hover:text-[var(--color-primary)] sm:text-sm"
        >
          {product.name}
        </Link>

        {avgRating !== null && avgRating > 0 && (
          <div className="mb-1 inline-flex items-center gap-1 text-[11px] text-[var(--color-text-secondary)]">
            <span className="flex items-center" aria-label={`Рейтинг ${avgRating.toFixed(1)} з 5`}>
              {[0, 1, 2, 3, 4].map((i) => {
                const filled = avgRating >= i + 1;
                const half = !filled && avgRating > i + 0.25 && avgRating < i + 0.75;
                return (
                  <svg
                    key={i}
                    className={`h-3 w-3 ${filled ? 'text-[var(--color-gold)]' : half ? 'text-[var(--color-gold-light)]' : 'text-[var(--color-border)]'}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M10 1.5l2.6 5.6 6.1.9-4.4 4.3 1 6.1L10 15.6 4.7 18.4l1-6.1L1.3 8l6.1-.9L10 1.5z" />
                  </svg>
                );
              })}
            </span>
            {reviewCount > 0 && <span className="font-medium">({reviewCount})</span>}
          </div>
        )}

        {product.brand && (
          <Link
            href={`/catalog?brand=${product.brand.slug}`}
            className="mb-1 inline-block truncate text-[10px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary)] sm:text-[11px]"
          >
            {product.brand.name}
          </Link>
        )}

        {attributes.length > 0 && (
          <div className="mb-1 flex flex-wrap gap-1">
            {attributes.map((attr) => (
              <span
                key={attr}
                className="inline-flex items-center rounded-md bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]"
              >
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

          <div className="@container mt-2.5 flex items-center justify-between gap-1 sm:mt-3 sm:gap-2">
            <span
              className={`min-w-0 truncate text-[10px] font-medium sm:text-xs ${inStock ? 'text-[var(--color-in-stock)]' : 'text-[var(--color-out-of-stock)]'}`}
            >
              {inStock ? 'В наявності' : 'Немає'}
            </span>
            <button
              onClick={handleAddToCart}
              disabled={!inStock}
              className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-primary)] px-2 py-1.5 text-xs font-medium text-white shadow-[var(--shadow-brand)] transition-all hover:bg-[var(--color-primary-dark)] hover:shadow-[var(--shadow-brand-lg)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none @[170px]:px-3"
              aria-label="В кошик"
            >
              <Cart size={14} />
              <span className="hidden @[170px]:inline">В кошик</span>
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
