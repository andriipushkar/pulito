'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import EmptyState from '@/components/ui/EmptyState';
import Spinner from '@/components/ui/Spinner';
import PageHeader from '@/components/account/PageHeader';

interface Notification {
  id: number;
  notificationType: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

// Маппінг типу сповіщення → іконка/колір. Ключі мають точно співпадати з
// `notificationType`, який пише сервер (services/notification.ts,
// services/email-sequences.ts тощо). Все інше падає на system-візуал.
const ORDER_ICON =
  'M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z';
const PROMO_ICON =
  'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z';
const PRICE_ICON =
  'M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941';
const STOCK_ICON =
  'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z';
const STAR_ICON =
  'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z';
const SYSTEM_ICON =
  'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z';

const ORDER_STYLE = { bg: 'bg-blue-50 text-blue-600', text: 'text-blue-600' };
const PROMO_STYLE = { bg: 'bg-emerald-50 text-emerald-600', text: 'text-emerald-600' };
const PRICE_STYLE = { bg: 'bg-amber-50 text-amber-600', text: 'text-amber-600' };
const REVIEW_STYLE = { bg: 'bg-yellow-50 text-yellow-600', text: 'text-yellow-600' };
const SYSTEM_STYLE = { bg: 'bg-violet-50 text-violet-600', text: 'text-violet-600' };

const TYPE_CONFIG: Record<string, { icon: string; bg: string; text: string }> = {
  order_status: { icon: ORDER_ICON, ...ORDER_STYLE },
  promo: { icon: PROMO_ICON, ...PROMO_STYLE },
  price_change: { icon: PRICE_ICON, ...PRICE_STYLE },
  back_in_stock: { icon: STOCK_ICON, ...PRICE_STYLE },
  review_request: { icon: STAR_ICON, ...REVIEW_STYLE },
  welcome: { icon: SYSTEM_ICON, ...SYSTEM_STYLE },
  winback: { icon: SYSTEM_ICON, ...SYSTEM_STYLE },
  system_notification: { icon: SYSTEM_ICON, ...SYSTEM_STYLE },
};

export default function NotificationsPage() {
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await apiClient.get<NotificationsResponse>('/api/v1/me/notifications');
      if (res.success && res.data) {
        setData(res.data);
      }
      setIsLoading(false);
    };
    load();
  }, []);

  const markAsRead = async (id: number) => {
    await apiClient.put(`/api/v1/me/notifications/${id}/read`);
    setData((prev) =>
      prev
        ? {
            ...prev,
            notifications: prev.notifications.map((n) =>
              n.id === id ? { ...n, isRead: true } : n,
            ),
            unreadCount: Math.max(0, prev.unreadCount - 1),
          }
        : prev,
    );
  };

  const markAllAsRead = async () => {
    await apiClient.put('/api/v1/me/notifications');
    setData((prev) =>
      prev
        ? {
            ...prev,
            notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
            unreadCount: 0,
          }
        : prev,
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  const notifications = data?.notifications || [];

  if (notifications.length === 0) {
    return (
      <div>
        <PageHeader
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
              />
            </svg>
          }
          title="Сповіщення"
        />
        <EmptyState
          icon={
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-50 text-violet-400">
              <svg
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                />
              </svg>
            </div>
          }
          title="Немає сповіщень"
          description="Тут будуть відображатися сповіщення про замовлення, акції та інші важливі події"
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
            />
          </svg>
        }
        title={
          <span className="flex items-center gap-2">
            Сповіщення
            {data && data.unreadCount > 0 && (
              <span className="rounded-full bg-[var(--color-primary)]/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--color-primary)]">
                {data.unreadCount}
              </span>
            )}
          </span>
        }
        subtitle={
          data && data.unreadCount > 0
            ? `${data.unreadCount} непрочитаних`
            : 'Усі сповіщення прочитані'
        }
        actions={
          <div className="flex items-center gap-2">
            {data && data.unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-2 rounded-xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] px-4 py-2 text-sm font-medium text-[var(--color-text)] shadow-sm transition-colors hover:bg-[var(--color-bg-secondary)]"
              >
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
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Прочитати всі
              </button>
            )}
            <Link
              href="/account/notifications/preferences"
              className="flex items-center gap-2 rounded-xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] px-4 py-2 text-sm font-medium text-[var(--color-text)] shadow-sm transition-colors hover:bg-[var(--color-bg-secondary)]"
            >
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
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Налаштування
            </Link>
          </div>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]">
        {notifications.map((n, idx) => {
          const config = TYPE_CONFIG[n.notificationType] || TYPE_CONFIG.system;

          const card = (
            <div className="flex items-start gap-3 p-4">
              <div
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${config.bg}`}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className={`text-sm font-semibold ${!n.isRead ? 'text-[var(--color-text)]' : 'text-[var(--color-text-secondary)]'}`}
                  >
                    {n.title}
                  </h3>
                  <span className="shrink-0 text-xs text-[var(--color-text-secondary)]">
                    {new Date(n.createdAt).toLocaleDateString('uk-UA')}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{n.message}</p>
              </div>
              {!n.isRead && (
                <div className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-violet-500" />
              )}
            </div>
          );

          const wrapperClasses = `block cursor-pointer transition-colors hover:bg-[var(--color-bg-secondary)] ${
            idx > 0 ? 'border-t border-[var(--color-border)]' : ''
          } ${!n.isRead ? 'border-l-2 border-l-violet-500' : ''}`;

          if (n.link) {
            return (
              <Link
                key={n.id}
                href={n.link}
                onClick={() => !n.isRead && markAsRead(n.id)}
                className={wrapperClasses}
              >
                {card}
              </Link>
            );
          }

          return (
            <div
              key={n.id}
              onClick={() => !n.isRead && markAsRead(n.id)}
              className={wrapperClasses}
            >
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
}
