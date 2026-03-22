'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { apiClient } from '@/lib/api-client';

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Щотижня',
  biweekly: 'Кожні 2 тижні',
  monthly: 'Щомісяця',
  bimonthly: 'Кожні 2 місяці',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Активна', color: '#4CAF50', bg: '#4CAF5018' },
  paused: { label: 'Призупинена', color: '#FF9800', bg: '#FF980018' },
  cancelled: { label: 'Скасована', color: '#F44336', bg: '#F4433618' },
};

interface SubscriptionItem {
  id: number;
  quantity: number;
  product: {
    id: number;
    name: string;
    code?: string;
    priceRetail: number | string;
    imagePath?: string | null;
  };
}

interface Subscription {
  id: number;
  frequency: string;
  status: string;
  nextDeliveryAt: string | Date;
  createdAt: string | Date;
  items: SubscriptionItem[];
}

interface SubscriptionCardProps {
  subscription: Subscription;
  onUpdate: () => void;
}

export default function SubscriptionCard({ subscription, onUpdate }: SubscriptionCardProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const status = STATUS_CONFIG[subscription.status] || STATUS_CONFIG.active;
  const frequency = FREQUENCY_LABELS[subscription.frequency] || subscription.frequency;

  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const total = subscription.items.reduce(
    (sum, item) => sum + Number(item.product.priceRetail) * item.quantity,
    0
  );

  const handleAction = async (action: 'pause' | 'resume' | 'cancel') => {
    setIsLoading(action);
    try {
      if (action === 'cancel') {
        await apiClient.delete(`/api/v1/me/subscriptions/${subscription.id}`);
      } else {
        const newStatus = action === 'pause' ? 'paused' : 'active';
        await apiClient.patch(`/api/v1/me/subscriptions/${subscription.id}`, {
          status: newStatus,
        });
      }
      onUpdate();
    } catch {
      // silently fail — user can retry
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)]/60 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.015 4.356v4.992" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">{frequency}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Створена {formatDate(subscription.createdAt)}
            </p>
          </div>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: status.bg, color: status.color }}
        >
          {status.label}
        </span>
      </div>

      {/* Items */}
      <div className="px-5 py-4">
        {subscription.status !== 'cancelled' && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-[var(--color-bg-secondary)]/60 px-3 py-2">
            <svg className="h-4 w-4 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs text-[var(--color-text-secondary)]">
              Наступна доставка:{' '}
              <strong className="text-[var(--color-text)]">
                {formatDate(subscription.nextDeliveryAt)}
              </strong>
            </span>
          </div>
        )}

        <div className="space-y-2">
          {subscription.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-[var(--color-text)]">
                {item.product.name}
              </span>
              <span className="shrink-0 text-[var(--color-text-secondary)]">
                x{item.quantity} &middot; {Number(item.product.priceRetail).toFixed(2)} ₴
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)]/60 pt-3">
          <span className="text-sm text-[var(--color-text-secondary)]">Разом за доставку</span>
          <span className="text-base font-bold text-[var(--color-text)]">
            {total.toFixed(2)} ₴
          </span>
        </div>
      </div>

      {/* Actions */}
      {subscription.status !== 'cancelled' && (
        <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)]/60 px-5 py-3">
          {subscription.status === 'active' && (
            <Button
              variant="outline"
              size="sm"
              isLoading={isLoading === 'pause'}
              onClick={() => handleAction('pause')}
            >
              Призупинити
            </Button>
          )}
          {subscription.status === 'paused' && (
            <Button
              variant="primary"
              size="sm"
              isLoading={isLoading === 'resume'}
              onClick={() => handleAction('resume')}
            >
              Відновити
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            isLoading={isLoading === 'cancel'}
            onClick={() => handleAction('cancel')}
          >
            Скасувати
          </Button>
        </div>
      )}
    </div>
  );
}
