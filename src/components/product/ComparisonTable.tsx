'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useComparison } from '@/hooks/useComparison';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { resolveWholesalePrice } from '@/lib/wholesale-price';
import { Cart, Trash, Compare } from '@/components/icons';
import PriceDisplay from './PriceDisplay';
import type { ProductListItem } from '@/types/product';

export default function ComparisonTable() {
  const { ids, remove, clear, count } = useComparison();
  const { addItem } = useCart();
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ids.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    apiClient
      .get<ProductListItem[]>(`/api/v1/products/by-ids?ids=${ids.join(',')}`)
      .then((res) => {
        if (res.success && res.data) {
          setProducts(res.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ids]);

  const handleAddToCart = (product: ProductListItem) => {
    if (product.quantity <= 0) return;
    const mainImage = product.images[0]?.pathMedium || product.imagePath;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-bg-secondary)]">
          <Compare size={40} className="text-[var(--color-text-secondary)]" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-[var(--color-text)]">
          Список порівняння порожній
        </h2>
        <p className="mb-6 max-w-md text-sm text-[var(--color-text-secondary)]">
          Додайте товари для порівняння, натиснувши іконку порівняння на картці товару.
          Можна порівняти до 4 товарів одночасно.
        </p>
        <Link
          href="/catalog"
          className="rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-brand)] transition-colors hover:bg-[var(--color-primary-dark)]"
        >
          Перейти до каталогу
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {count} {count === 1 ? 'товар' : count < 5 ? 'товари' : 'товарів'} для порівняння
        </p>
        <button
          onClick={clear}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/10"
        >
          <Trash size={14} />
          Очистити все
        </button>
      </div>

      {/* Desktop table view */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-40 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Характеристика
              </th>
              {products.map((product) => (
                <th key={product.id} className="min-w-[200px] border-b border-[var(--color-border)] p-3 text-center">
                  <button
                    onClick={() => remove(product.id)}
                    className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-danger)]"
                    aria-label={`Видалити ${product.name} з порівняння`}
                  >
                    <Trash size={12} />
                    Видалити
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Image row */}
            <tr>
              <td className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Фото
              </td>
              {products.map((product) => {
                const img = product.images[0]?.pathMedium || product.imagePath;
                return (
                  <td key={product.id} className="border-b border-[var(--color-border)] p-3 text-center">
                    <Link href={`/product/${product.slug}`} className="inline-block">
                      {img ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={img}
                          alt={product.name}
                          loading="lazy"
                          className="mx-auto h-32 w-32 rounded-lg object-contain"
                        />
                      ) : (
                        <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-lg bg-[var(--color-bg-secondary)]">
                          <span className="text-xs text-[var(--color-text-secondary)]">Немає фото</span>
                        </div>
                      )}
                    </Link>
                  </td>
                );
              })}
            </tr>

            {/* Name row */}
            <tr>
              <td className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Назва
              </td>
              {products.map((product) => (
                <td key={product.id} className="border-b border-[var(--color-border)] p-3 text-center">
                  <Link
                    href={`/product/${product.slug}`}
                    className="text-sm font-medium text-[var(--color-text)] hover:text-[var(--color-primary)]"
                  >
                    {product.name}
                  </Link>
                </td>
              ))}
            </tr>

            {/* Price row */}
            <tr>
              <td className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Ціна
              </td>
              {products.map((product) => (
                <td key={product.id} className="border-b border-[var(--color-border)] p-3 text-center">
                  <PriceDisplay
                    priceRetail={product.priceRetail}
                    priceRetailOld={product.priceRetailOld}
                    priceWholesale={product.priceWholesale}
                    priceWholesale2={product.priceWholesale2}
                    priceWholesale3={product.priceWholesale3}
                    size="sm"
                  />
                </td>
              ))}
            </tr>

            {/* Category row */}
            <tr>
              <td className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Категорія
              </td>
              {products.map((product) => (
                <td key={product.id} className="border-b border-[var(--color-border)] p-3 text-center text-sm text-[var(--color-text)]">
                  {product.category ? (
                    <Link
                      href={`/catalog?category=${product.category.slug}`}
                      className="text-[var(--color-primary)] hover:underline"
                    >
                      {product.category.name}
                    </Link>
                  ) : (
                    <span className="text-[var(--color-text-secondary)]">—</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Stock row */}
            <tr>
              <td className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Наявність
              </td>
              {products.map((product) => {
                const inStock = product.quantity > 0;
                return (
                  <td key={product.id} className="border-b border-[var(--color-border)] p-3 text-center">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${inStock ? 'bg-green-50 text-[var(--color-in-stock)]' : 'bg-red-50 text-[var(--color-out-of-stock)]'}`}>
                      {inStock ? 'В наявності' : 'Немає в наявності'}
                    </span>
                  </td>
                );
              })}
            </tr>

            {/* Description row */}
            <tr>
              <td className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Опис
              </td>
              {products.map((product) => (
                <td key={product.id} className="border-b border-[var(--color-border)] p-3 text-center text-sm text-[var(--color-text)]">
                  {product.content?.shortDescription || (
                    <span className="text-[var(--color-text-secondary)]">—</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Code row */}
            <tr>
              <td className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Код товару
              </td>
              {products.map((product) => (
                <td key={product.id} className="border-b border-[var(--color-border)] p-3 text-center text-sm text-[var(--color-text-secondary)]">
                  {product.code}
                </td>
              ))}
            </tr>

            {/* Add to cart row */}
            <tr>
              <td className="bg-[var(--color-bg-secondary)] p-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Дія
              </td>
              {products.map((product) => {
                const inStock = product.quantity > 0;
                return (
                  <td key={product.id} className="p-3 text-center">
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={!inStock}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-brand)] transition-all hover:bg-[var(--color-primary-dark)] hover:shadow-[var(--shadow-brand-lg)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                    >
                      <Cart size={16} />
                      В кошик
                    </button>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="flex flex-col gap-4 md:hidden">
        {products.map((product) => {
          const img = product.images[0]?.pathMedium || product.imagePath;
          const inStock = product.quantity > 0;
          return (
            <div
              key={product.id}
              className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]"
            >
              <div className="flex items-start gap-3 p-3">
                <Link href={`/product/${product.slug}`} className="shrink-0">
                  {img ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={img}
                      alt={product.name}
                      loading="lazy"
                      className="h-20 w-20 rounded-lg object-contain"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-[var(--color-bg-secondary)]">
                      <span className="text-[10px] text-[var(--color-text-secondary)]">Немає фото</span>
                    </div>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/product/${product.slug}`}
                    className="line-clamp-2 text-sm font-medium text-[var(--color-text)] hover:text-[var(--color-primary)]"
                  >
                    {product.name}
                  </Link>
                  {product.category && (
                    <span className="mt-0.5 block text-xs text-[var(--color-text-secondary)]">
                      {product.category.name}
                    </span>
                  )}
                  <div className="mt-1">
                    <PriceDisplay
                      priceRetail={product.priceRetail}
                      priceRetailOld={product.priceRetailOld}
                      size="sm"
                    />
                  </div>
                  <span className={`mt-1 inline-block text-xs font-medium ${inStock ? 'text-[var(--color-in-stock)]' : 'text-[var(--color-out-of-stock)]'}`}>
                    {inStock ? 'В наявності' : 'Немає в наявності'}
                  </span>
                </div>
                <button
                  onClick={() => remove(product.id)}
                  className="shrink-0 rounded-full p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-danger)]"
                  aria-label={`Видалити ${product.name} з порівняння`}
                >
                  <Trash size={16} />
                </button>
              </div>

              {product.content?.shortDescription && (
                <div className="border-t border-[var(--color-border)] px-3 py-2">
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {product.content.shortDescription}
                  </p>
                </div>
              )}

              <div className="border-t border-[var(--color-border)] p-3">
                <button
                  onClick={() => handleAddToCart(product)}
                  disabled={!inStock}
                  className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-brand)] transition-all hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  <Cart size={16} />
                  В кошик
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
