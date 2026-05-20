'use client';

import { useEffect, useState } from 'react';
import { useCart } from '@/hooks/useCart';
import { apiClient } from '@/lib/api-client';
import { Cart as CartIcon } from '@/components/icons';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import EmptyState from '@/components/ui/EmptyState';
import CartItemRow from '@/components/cart/CartItemRow';
import CartSummary from '@/components/cart/CartSummary';
import CartRecommendations from '@/components/cart/CartRecommendations';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import type { CheckoutConfig } from '@/services/checkout-config';

export default function CartPage() {
  const { items, itemCount, total, updateQuantity, removeItem, clearCart } = useCart();
  const cartTotal = total();
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<number | null>(null);

  useEffect(() => {
    apiClient
      .get<CheckoutConfig>('/api/v1/checkout/config')
      .then((res) => {
        if (res.success && res.data) {
          setFreeShippingThreshold(res.data.delivery.freeShippingThreshold);
        }
      })
      .catch((err) => {
        console.warn('Failed to load checkout config', err);
      });
  }, []);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Breadcrumbs items={[{ label: 'Головна', href: '/' }, { label: 'Кошик' }]} />
        <EmptyState
          icon={<CartIcon size={48} />}
          title="Кошик порожній"
          description="Додайте товари з каталогу, щоб оформити замовлення"
          actionLabel="Перейти до каталогу"
          actionHref="/catalog"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageViewTracker eventType="cart_view" metadata={{ itemCount, total: cartTotal }} />
      <Breadcrumbs items={[{ label: 'Головна', href: '/' }, { label: 'Кошик' }]} className="mb-6" />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Кошик ({itemCount})</h1>
        <button
          onClick={() => {
            if (
              window.confirm(
                'Видалити всі товари з кошика? Цю дію не можна скасувати.',
              )
            ) {
              clearCart();
            }
          }}
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
        >
          Очистити кошик
        </button>
      </div>

      <div className="gap-8 lg:grid lg:grid-cols-[1fr_360px]">
        {/* Items */}
        <div>
          {/* Table header (desktop) */}
          <div className="hidden border-b border-[var(--color-border)] pb-2 sm:grid sm:grid-cols-[1fr_96px_136px_112px_40px] sm:gap-4 sm:px-[96px]">
            <span className="text-xs font-medium uppercase text-[var(--color-text-secondary)]">
              Товар
            </span>
            <span className="text-right text-xs font-medium uppercase text-[var(--color-text-secondary)]">
              Ціна
            </span>
            <span className="text-center text-xs font-medium uppercase text-[var(--color-text-secondary)]">
              Кількість
            </span>
            <span className="text-right text-xs font-medium uppercase text-[var(--color-text-secondary)]">
              Сума
            </span>
            <span />
          </div>

          {items.map((item) => (
            <CartItemRow
              key={item.productId}
              item={item}
              onUpdateQuantity={updateQuantity}
              onRemove={removeItem}
            />
          ))}
        </div>

        {/* Summary */}
        <div className="mt-6 lg:mt-0">
          <div className="sticky top-24">
            <CartSummary
              itemCount={itemCount}
              total={cartTotal}
              freeShippingThreshold={freeShippingThreshold}
            />
          </div>
        </div>
      </div>

      <CartRecommendations cartProductIds={items.map((i) => i.productId)} />
    </div>
  );
}
