'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { TabKey } from './_shared';
import { ProductsTab } from './_components/ProductsTab';
import { HistoryTab } from './_components/HistoryTab';
import { MessagesTab } from './_components/MessagesTab';
import { AnalyticsTab } from './_components/AnalyticsTab';
import { SettingsTab } from './_components/SettingsTab';

export default function MarketplacesPage() {
  const [tab, setTab] = useState<TabKey>('products');
  const [messageCount, setMessageCount] = useState(0);

  // Load unread message count
  useEffect(() => {
    apiClient
      .get<{ id: string; isRead: boolean }[]>('/api/v1/admin/marketplaces/messages')
      .then((res) => {
        if (res.success && res.data) {
          setMessageCount(res.data.filter((m) => !m.isRead).length);
        }
      });
  }, [tab]);

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'products', label: 'Публікація товарів' },
    { key: 'history', label: 'Історія' },
    { key: 'messages', label: 'Повідомлення', badge: messageCount },
    { key: 'analytics', label: 'Аналітика' },
    { key: 'settings', label: 'Налаштування API' },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Маркетплейси</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Публікуйте товари на OLX, Rozetka, Prom.ua та Epicentr K
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <a
            href="/admin/marketplaces/categories"
            className="rounded border border-[var(--color-border)] px-3 py-1.5 hover:bg-[var(--color-bg-secondary)]"
          >
            Mapping категорій
          </a>
          <a
            href="/admin/marketplaces/returns"
            className="rounded border border-[var(--color-border)] px-3 py-1.5 hover:bg-[var(--color-bg-secondary)]"
          >
            Повернення
          </a>
          <a
            href="/admin/marketplaces/disputes"
            className="rounded border border-[var(--color-border)] px-3 py-1.5 hover:bg-[var(--color-bg-secondary)]"
          >
            Спори
          </a>
          <a
            href="/admin/marketplaces/repricing"
            className="rounded border border-[var(--color-border)] px-3 py-1.5 hover:bg-[var(--color-bg-secondary)]"
          >
            Repricing
          </a>
          <a
            href="/admin/marketplaces/pick-list"
            className="rounded border border-[var(--color-border)] px-3 py-1.5 hover:bg-[var(--color-bg-secondary)]"
          >
            Pick-list
          </a>
          <a
            href="/admin/marketplaces/buyer"
            className="rounded border border-[var(--color-border)] px-3 py-1.5 hover:bg-[var(--color-bg-secondary)]"
          >
            Картка покупця
          </a>
          <a
            href="/admin/marketplaces/audit"
            className="rounded border border-[var(--color-border)] px-3 py-1.5 hover:bg-[var(--color-bg-secondary)]"
          >
            Webhook журнал
          </a>
          <a
            href="/admin/marketplaces/help"
            className="rounded border border-[var(--color-border)] px-3 py-1.5 hover:bg-[var(--color-bg-secondary)]"
          >
            Довідка
          </a>
        </div>
      </div>

      <div className="mb-6 flex gap-1 rounded-[var(--radius)] bg-[var(--color-bg-secondary)] p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative rounded-[var(--radius)] px-4 py-2 text-sm font-medium transition-colors ${tab === t.key ? 'bg-[var(--color-bg)] shadow-sm' : 'text-[var(--color-text-secondary)]'}`}
          >
            {t.label}
            {t.badge ? (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {t.badge > 99 ? '99+' : t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'products' && <ProductsTab />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'messages' && <MessagesTab />}
      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
}
