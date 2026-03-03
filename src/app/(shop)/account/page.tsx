'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { apiClient } from '@/lib/api-client';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types/order';
import type { OrderListItem, OrderStatus } from '@/types/order';
import Spinner from '@/components/ui/Spinner';

interface FrequentProduct {
  productId: number;
  productName: string;
  productCode: string;
  imagePath: string | null;
  totalQuantity: number;
  ordersCount: number;
}

export default function AccountDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { addItem } = useCart();
  const [recentOrders, setRecentOrders] = useState<OrderListItem[]>([]);
  const [frequentProducts, setFrequentProducts] = useState<FrequentProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [repeatingOrderId, setRepeatingOrderId] = useState<number | null>(null);

  useEffect(() => {
    const promises: Promise<void>[] = [
      apiClient
        .get<OrderListItem[]>('/api/v1/orders?page=1&limit=3')
        .then((res) => {
          if (res.success && res.data) setRecentOrders(res.data);
        }),
    ];

    if (user?.role === 'wholesaler') {
      promises.push(
        apiClient
          .get<FrequentProduct[]>('/api/v1/orders/frequent-products?limit=6')
          .then((res) => {
            if (res.success && res.data) setFrequentProducts(res.data);
          })
      );
    }

    Promise.all(promises).finally(() => setIsLoading(false));
  }, [user?.role]);

  const handleRepeatOrder = async (orderId: number) => {
    setRepeatingOrderId(orderId);
    try {
      await apiClient.post(`/api/v1/orders/${orderId}/reorder`, {});
      // Navigate to cart after reorder
      router.push('/cart');
    } catch {
      // silently fail
      setRepeatingOrderId(null);
    }
  };

  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold">
        Вітаємо, {user?.fullName || user?.email}!
      </h2>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Quick links */}
        <Link
          href="/account/orders"
          className="rounded-[var(--radius)] border border-[var(--color-border)] p-4 transition-colors hover:border-[var(--color-primary)]/50"
        >
          <div className="mb-2 text-2xl">📦</div>
          <h3 className="font-semibold">Мої замовлення</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">Історія та відстеження</p>
        </Link>

        <Link
          href="/account/wishlist"
          className="rounded-[var(--radius)] border border-[var(--color-border)] p-4 transition-colors hover:border-[var(--color-primary)]/50"
        >
          <div className="mb-2 text-2xl">❤️</div>
          <h3 className="font-semibold">Обране</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">Збережені товари</p>
        </Link>

        <Link
          href="/account/settings"
          className="rounded-[var(--radius)] border border-[var(--color-border)] p-4 transition-colors hover:border-[var(--color-primary)]/50"
        >
          <div className="mb-2 text-2xl">⚙️</div>
          <h3 className="font-semibold">Налаштування</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">Профіль та безпека</p>
        </Link>
      </div>

      {/* Promo block for retail clients */}
      {user?.role !== 'wholesaler' && (
        <div className="mt-6 rounded-[var(--radius)] border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-5">
          <h3 className="mb-2 text-lg font-bold text-[var(--color-primary)]">Станьте оптовим клієнтом!</h3>
          <ul className="mb-4 space-y-1 text-sm text-[var(--color-text-secondary)]">
            <li>&#8226; Знижені ціни — економія до 30%</li>
            <li>&#8226; Персональний менеджер</li>
            <li>&#8226; Пріоритетна обробка замовлень</li>
            <li>&#8226; PDF-документи для бухгалтерії</li>
          </ul>
          <Link
            href="/pages/wholesale"
            className="inline-block rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Дізнатися більше
          </Link>
        </div>
      )}

      {/* Recent orders */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Останні замовлення</h3>
          <Link href="/account/orders" className="text-sm text-[var(--color-primary)] hover:underline">
            Усі замовлення
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] p-8 text-center">
            <p className="text-[var(--color-text-secondary)]">Ви ще не зробили жодного замовлення</p>
            <Link href="/catalog" className="mt-2 inline-block text-sm text-[var(--color-primary)] hover:underline">
              Перейти до каталогу
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--color-border)] p-4 transition-colors hover:border-[var(--color-primary)]/50"
              >
                <Link href={`/account/orders/${order.id}`} className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold">#{order.orderNumber}</span>
                      <span className="ml-2 text-sm text-[var(--color-text-secondary)]">
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold">{Number(order.totalAmount).toFixed(2)} ₴</span>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: ORDER_STATUS_COLORS[order.status as OrderStatus] }}
                      >
                        {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                      </span>
                    </div>
                  </div>
                </Link>
                {user?.role === 'wholesaler' && (
                  <button
                    onClick={() => handleRepeatOrder(order.id)}
                    disabled={repeatingOrderId === order.id}
                    className="ml-3 shrink-0 rounded-[var(--radius)] border border-[var(--color-primary)] px-3 py-1 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/10 disabled:opacity-50"
                  >
                    {repeatingOrderId === order.id ? 'Додаємо...' : 'Повторити'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Frequently ordered (wholesaler) */}
      {user?.role === 'wholesaler' && frequentProducts.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-4 text-lg font-semibold">Часто замовлені товари</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {frequentProducts.map((fp) => (
              <div
                key={fp.productId}
                className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] p-3"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-[var(--color-bg-secondary)]">
                  {fp.imagePath ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={fp.imagePath} alt={fp.productName} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)] opacity-30">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{fp.productName}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Замовлено {fp.ordersCount} {fp.ordersCount === 1 ? 'раз' : fp.ordersCount < 5 ? 'рази' : 'разів'}
                  </p>
                </div>
                <button
                  onClick={() =>
                    addItem({
                      productId: fp.productId,
                      name: fp.productName,
                      slug: '',
                      code: fp.productCode,
                      priceRetail: 0,
                      priceWholesale: null,
                      imagePath: fp.imagePath,
                      quantity: 1,
                      maxQuantity: 9999,
                    })
                  }
                  className="shrink-0 rounded-[var(--radius)] bg-[var(--color-primary)] p-2 text-white transition-colors hover:bg-[var(--color-primary-dark)]"
                  aria-label="Додати в кошик"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
