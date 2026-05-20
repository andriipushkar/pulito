'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { apiClient } from '@/lib/api-client';
import { displayName, plural } from '@/utils/format';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types/order';
import type { OrderListItem, OrderStatus } from '@/types/order';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/account/StatCard';
import RestockReminders from '@/components/account/RestockReminders';

interface FrequentProduct {
  productId: number;
  productName: string;
  productCode: string;
  imagePath: string | null;
  totalQuantity: number;
  ordersCount: number;
}

interface LoyaltyDashboard {
  account: { points: number; totalSpent: number; level: string };
  currentLevel: { name: string; discountPercent: number; minSpent: number } | null;
  nextLevel: { name: string; minSpent: number } | null;
}

interface OrdersSummary {
  totalOrders: number;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Доброго ранку';
  if (hour >= 12 && hour < 18) return 'Доброго дня';
  return 'Доброго вечора';
}

function levelLabel(name: string): string {
  const map: Record<string, string> = {
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
  };
  return map[(name || '').toLowerCase()] || name || '—';
}

const IconOrdersStat = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
  </svg>
);
const IconLoyaltyStat = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
  </svg>
);
const IconWalletStat = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375M21 18.75H3M12 9v3.75m0 0a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconCartStat = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
  </svg>
);

export default function AccountDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { addItem, itemCount, total } = useCart();
  const [recentOrders, setRecentOrders] = useState<OrderListItem[]>([]);
  const [totalOrders, setTotalOrders] = useState<number | null>(null);
  const [frequentProducts, setFrequentProducts] = useState<FrequentProduct[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [repeatingOrderId, setRepeatingOrderId] = useState<number | null>(null);

  useEffect(() => {
    const promises: Promise<void>[] = [
      apiClient.get<OrderListItem[]>('/api/v1/orders?page=1&limit=3').then((res) => {
        if (res.success && res.data) setRecentOrders(res.data);
        if (res.success && res.pagination) setTotalOrders(res.pagination.total);
      }),
      apiClient.get<LoyaltyDashboard>('/api/v1/me/loyalty').then((res) => {
        if (res.success && res.data) setLoyalty(res.data);
      }),
    ];

    if (user?.role === 'wholesaler') {
      promises.push(
        apiClient.get<FrequentProduct[]>('/api/v1/orders/frequent-products?limit=6').then((res) => {
          if (res.success && res.data) setFrequentProducts(res.data);
        }),
      );
    }

    Promise.all(promises).finally(() => setIsLoading(false));
  }, [user?.role]);

  // Loyalty progress: how far to the next level
  const loyaltyProgress = (() => {
    if (!loyalty) return null;
    const current = loyalty.account.totalSpent;
    const next = loyalty.nextLevel?.minSpent;
    if (!next || next <= 0) return null;
    const prev = loyalty.currentLevel?.minSpent ?? 0;
    const range = Math.max(next - prev, 1);
    const reached = Math.max(0, current - prev);
    const percent = Math.min(100, Math.round((reached / range) * 100));
    return { percent, remaining: Math.max(0, next - current), nextName: levelLabel(loyalty.nextLevel!.name) };
  })();

  const handleRepeatOrder = async (orderId: number) => {
    setRepeatingOrderId(orderId);
    try {
      await apiClient.post(`/api/v1/orders/${orderId}/reorder`, {});
      router.push('/cart');
    } catch {
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
    <div className="space-y-8">
      {/* ── Greeting ── */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text)]">
          {getGreeting()}, {displayName(user)}
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Керуйте замовленнями, адресами та налаштуваннями акаунту
        </p>
      </div>

      {/* ── Live stat cards (replaces old quick-links that duplicated sidebar) ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/account/orders" className="block transition-transform hover:-translate-y-0.5">
          <StatCard
            label="Замовлень"
            value={totalOrders ?? '—'}
            subtitle={totalOrders === 0 ? 'Ще немає замовлень' : 'За весь час'}
            icon={IconOrdersStat}
            iconBg="bg-orange-50 text-orange-600"
          />
        </Link>
        <Link href="/account/loyalty" className="block transition-transform hover:-translate-y-0.5">
          <StatCard
            label="Балів"
            value={loyalty?.account.points ?? 0}
            subtitle={`Рівень: ${levelLabel(loyalty?.account.level || 'bronze')}`}
            icon={IconLoyaltyStat}
            iconBg="bg-amber-50 text-amber-600"
          />
        </Link>
        <Link href="/account/loyalty" className="block transition-transform hover:-translate-y-0.5">
          <StatCard
            label="Витрачено"
            value={loyalty ? `${Math.round(loyalty.account.totalSpent)} ₴` : '0 ₴'}
            subtitle={
              loyalty?.currentLevel?.discountPercent
                ? `Знижка ${loyalty.currentLevel.discountPercent}%`
                : 'Поки без знижки'
            }
            icon={IconWalletStat}
            iconBg="bg-emerald-50 text-emerald-600"
          />
        </Link>
        <Link href="/cart" className="block transition-transform hover:-translate-y-0.5">
          <StatCard
            label="У кошику"
            value={`${itemCount} ${plural(itemCount, ['товар', 'товари', 'товарів'])}`}
            subtitle={itemCount > 0 ? `На суму ${Math.round(total(user?.role))} ₴` : 'Кошик порожній'}
            icon={IconCartStat}
            iconBg="bg-sky-50 text-sky-600"
          />
        </Link>
      </div>

      {/* ── Loyalty progress (only when there's a next level to reach) ── */}
      {loyaltyProgress && (
        <Link
          href="/account/loyalty"
          className="block overflow-hidden rounded-2xl border border-[var(--color-border)]/60 bg-gradient-to-br from-amber-50/60 via-white to-amber-50/30 p-5 transition-shadow hover:shadow-md"
        >
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--color-text)]">
              До рівня {loyaltyProgress.nextName}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {loyaltyProgress.percent}% • залишилось {Math.round(loyaltyProgress.remaining)} ₴
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--color-gold)] to-amber-400 transition-all duration-500"
              style={{ width: `${loyaltyProgress.percent}%` }}
            />
          </div>
        </Link>
      )}

      {/* ── Wholesale promo ── */}
      {user?.role !== 'wholesaler' && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58"
                />
              </svg>
            </div>
            <div>
              <span className="text-sm font-semibold text-[var(--color-text)]">
                Станьте гуртовим клієнтом
              </span>
              <span className="ml-2 hidden text-xs text-[var(--color-text-secondary)] sm:inline">
                Знижки до 30%
              </span>
            </div>
          </div>
          <Link
            href="/account/wholesale-request"
            className="rounded-lg bg-[var(--color-text)] px-4 py-1.5 text-xs font-medium text-[var(--color-bg)] transition-opacity hover:opacity-80"
          >
            Подати заявку
          </Link>
        </div>
      )}

      {/* ── Recent orders ── */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--color-text)]">Останні замовлення</h3>
          <Link
            href="/account/orders"
            className="text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            Дивитись усі
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : recentOrders.length === 0 ? (
          <EmptyState
            icon={
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
              </svg>
            }
            title="Ще немає замовлень"
            description="Перегляньте каталог і додайте перші товари в кошик"
            actionLabel="Перейти до каталогу"
            actionHref="/catalog"
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] shadow-sm">
            {recentOrders.map((order, i) => (
              <div
                key={order.id}
                className={`flex items-center justify-between p-4 transition-colors hover:bg-[var(--color-bg-secondary)]/50 ${
                  i < recentOrders.length - 1 ? 'border-b border-[var(--color-border)]/60' : ''
                }`}
              >
                <Link href={`/account/orders/${order.id}`} className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                          />
                        </svg>
                      </div>
                      <div>
                        <span className="text-sm font-semibold">#{order.orderNumber}</span>
                        <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                          {formatDate(order.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold">
                        {Number(order.totalAmount).toFixed(2)} ₴
                      </span>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: ORDER_STATUS_COLORS[order.status as OrderStatus] + '18',
                          color: ORDER_STATUS_COLORS[order.status as OrderStatus],
                        }}
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
                    className="ml-3 shrink-0 rounded-lg border border-[var(--color-border)]/60 px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)] disabled:opacity-50"
                  >
                    {repeatingOrderId === order.id ? 'Додаємо...' : 'Повторити'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Frequently ordered (wholesaler) ── */}
      {user?.role === 'wholesaler' && frequentProducts.length > 0 && (
        <div>
          <h3 className="mb-4 text-base font-bold text-[var(--color-text)]">
            Часто замовлені товари
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {frequentProducts.map((fp) => (
              <div
                key={fp.productId}
                className="flex items-center gap-3 rounded-xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] p-3 transition-colors hover:bg-[var(--color-bg-secondary)]/50"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--color-bg-secondary)]">
                  {fp.imagePath ? (
                    <Image
                      src={fp.imagePath}
                      alt={fp.productName}
                      fill
                      sizes="48px"
                      className="object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)] opacity-30">
                      <svg
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{fp.productName}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Замовлено {fp.ordersCount}{' '}
                    {fp.ordersCount === 1 ? 'раз' : fp.ordersCount < 5 ? 'рази' : 'разів'}
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
                  className="shrink-0 rounded-lg bg-[var(--color-text)] p-2 text-[var(--color-bg)] transition-opacity hover:opacity-80"
                  aria-label="Додати в кошик"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <RestockReminders />
      </div>
    </div>
  );
}
