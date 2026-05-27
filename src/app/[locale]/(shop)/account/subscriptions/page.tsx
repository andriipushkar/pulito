'use client';

import { Link } from '@/i18n/navigation';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/account/PageHeader';
import SubscriptionCard from '@/components/account/SubscriptionCard';
import { useSubscriptions } from '@/hooks/useSubscription';

export default function SubscriptionsPage() {
  const { subscriptions, isLoading, mutate } = useSubscriptions();

  const activeCount = subscriptions.filter((s) => s.status === 'active').length;
  const pausedCount = subscriptions.filter((s) => s.status === 'paused').length;

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
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.015 4.356v4.992"
            />
          </svg>
        }
        title="Мої підписки"
        subtitle="Автоматичні регулярні доставки"
        actions={
          <Link
            href="/catalog"
            className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)]"
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
            Створити підписку
          </Link>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : subscriptions.length === 0 ? (
        <EmptyState
          icon={
            <svg
              className="h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.015 4.356v4.992"
              />
            </svg>
          }
          title="Підписок немає"
          description="Підписуйтесь на регулярну доставку улюблених товарів та заощаджуйте"
          actionLabel="Перейти до каталогу"
          actionHref="/catalog"
        />
      ) : (
        <>
          {/* Summary badges */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
              {subscriptions.length}
            </span>
            <span className="text-sm text-[var(--color-text-secondary)]">
              {subscriptions.length === 1
                ? 'підписка'
                : subscriptions.length < 5
                  ? 'підписки'
                  : 'підписок'}
            </span>
            {activeCount > 0 && (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                {activeCount} {activeCount === 1 ? 'активна' : 'активних'}
              </span>
            )}
            {pausedCount > 0 && (
              <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-700">
                {pausedCount} {pausedCount === 1 ? 'призупинена' : 'призупинених'}
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
            {subscriptions.map((sub) => (
              <SubscriptionCard key={sub.id} subscription={sub} onUpdate={() => mutate()} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
