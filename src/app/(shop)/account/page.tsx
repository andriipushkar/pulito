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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Доброго ранку';
  if (hour >= 12 && hour < 18) return 'Доброго дня';
  return 'Доброго вечора';
}

const QUICK_LINKS = [
  {
    href: '/account/orders',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
      </svg>
    ),
    label: 'Замовлення',
    iconBg: 'bg-orange-50 text-orange-600',
  },
  {
    href: '/account/wishlist',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
    label: 'Обране',
    iconBg: 'bg-rose-50 text-rose-600',
  },
  {
    href: '/account/loyalty',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
    label: 'Бонуси',
    iconBg: 'bg-amber-50 text-amber-600',
  },
  {
    href: '/account/referral',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    label: 'Запросити друга',
    iconBg: 'bg-emerald-50 text-emerald-600',
  },
  {
    href: '/account/addresses',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
    label: 'Адреси',
    iconBg: 'bg-teal-50 text-teal-600',
  },
  {
    href: '/account/settings',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    label: 'Налаштування',
    iconBg: 'bg-slate-100 text-slate-600',
  },
];

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
          {getGreeting()}, {user?.fullName || user?.email}
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Керуйте замовленнями, адресами та налаштуваннями акаунту
        </p>
      </div>

      {/* ── Quick links grid ── */}
      <div className="stagger-children grid grid-cols-3 gap-2 sm:grid-cols-6">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex flex-col items-center gap-2 rounded-2xl p-3 transition-colors hover:bg-[var(--color-bg-secondary)]/50"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${link.iconBg}`}>
              {link.icon}
            </div>
            <span className="text-center text-xs font-medium text-[var(--color-text-secondary)] group-hover:text-[var(--color-text)]">{link.label}</span>
          </Link>
        ))}
      </div>

      {/* ── Wholesale promo ── */}
      {user?.role !== 'wholesaler' && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58" />
              </svg>
            </div>
            <div>
              <span className="text-sm font-semibold text-[var(--color-text)]">Станьте оптовим клієнтом</span>
              <span className="ml-2 hidden text-xs text-[var(--color-text-secondary)] sm:inline">Знижки до 30%</span>
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
          <Link href="/account/orders" className="text-sm font-medium text-[var(--color-primary)] hover:underline">
            Дивитись усі
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="rounded-2xl bg-[var(--color-bg-secondary)]/40 py-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-secondary)]">
              <svg className="h-6 w-6 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
              </svg>
            </div>
            <p className="font-medium text-[var(--color-text-secondary)]">Ви ще не зробили жодного замовлення</p>
            <Link href="/catalog" className="mt-2 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline">
              Перейти до каталогу
            </Link>
          </div>
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
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
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
                      <span className="text-sm font-bold">{Number(order.totalAmount).toFixed(2)} ₴</span>
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
          <h3 className="mb-4 text-base font-bold text-[var(--color-text)]">Часто замовлені товари</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {frequentProducts.map((fp) => (
              <div
                key={fp.productId}
                className="flex items-center gap-3 rounded-xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] p-3 transition-colors hover:bg-[var(--color-bg-secondary)]/50"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--color-bg-secondary)]">
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
                  className="shrink-0 rounded-lg bg-[var(--color-text)] p-2 text-[var(--color-bg)] transition-opacity hover:opacity-80"
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
